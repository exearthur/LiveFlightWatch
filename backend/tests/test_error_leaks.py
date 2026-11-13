"""Whatever the upstream provider does, its API key never reaches a response
or a log record, and the client only ever sees a fixed, generic message.

Each test drives the real app (`create_app`), with the real provider, service
and error handling, through an httpx MockTransport standing in for the
upstream API. The mocked upstream is as careless as it can be: every failure
echoes the request, key included. Nothing here reaches a real API.
"""

import asyncio
import logging
import traceback
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import quote, quote_plus

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.core.redaction import REDACTED
from app.errors import RATE_LIMIT_DETAIL, UPSTREAM_FAILURE_DETAIL
from app.main import create_app
from app.providers.aerodatabox import AeroDataBoxProvider
from app.providers.aviationstack import AviationStackProvider
from app.providers.base import FlightProvider, ProviderError, RateLimitError
from app.routers.flights import get_flight_service

KEYS = {
    "aviationstack": "as-live-7f3a9c2e41d85b60",
    "aerodatabox": "adb-live-0c6e1f9a3b7d2458",
}
UPSTREAM_HOST = "example.invalid"
BASE_URLS = {
    "aviationstack": f"https://aviationstack.{UPSTREAM_HOST}/v1/flights",
    "aerodatabox": f"https://aerodatabox.{UPSTREAM_HOST}",
}
# Marks text that came from upstream, so the tests can tell it never reaches
# a response (and does reach the log).
UPSTREAM_MARKER = "UPSTREAM-SAYS"

ENDPOINTS = {
    "/api/flights": {"airport": "JFK", "type": "departures"},
    "/api/flights/lookup": {"flight_number": "AA100"},
}
GENERIC_DETAILS = {429: RATE_LIMIT_DETAIL, 502: UPSTREAM_FAILURE_DETAIL}


def _settings(provider: str, **overrides: Any) -> Settings:
    values: dict[str, Any] = {
        # keeps a developer's local .env out of the test
        "_env_file": None,
        "flight_provider": provider,
        "aviationstack_api_key": KEYS["aviationstack"],
        "aviationstack_base_url": BASE_URLS["aviationstack"],
        "aerodatabox_api_key": KEYS["aerodatabox"],
        "aerodatabox_base_url": BASE_URLS["aerodatabox"],
        **overrides,
    }
    return Settings(**values)


def _echo(request: httpx.Request) -> str:
    """The request as a careless upstream would repeat it: the key by itself,
    the full URL (AviationStack's has the key in it) and every header
    (AeroDataBox's has the key in one)."""
    key = request.url.params.get("access_key") or request.headers.get("x-rapidapi-key")
    return (
        f"{UPSTREAM_MARKER} key {key} is not valid for {request.method} {request.url} "
        f"sent with {dict(request.headers)}"
    )


# --- the ways upstream can fail ---------------------------------------------------

Behaviour = Callable[[httpx.Request], httpx.Response]


def _connect_error(request: httpx.Request) -> httpx.Response:
    raise httpx.ConnectError(f"All connection attempts failed: {_echo(request)}", request=request)


def _read_timeout(request: httpx.Request) -> httpx.Response:
    raise httpx.ReadTimeout(f"Timed out reading {_echo(request)}", request=request)


def _server_error(request: httpx.Request) -> httpx.Response:
    return httpx.Response(500, text=f"<html>{_echo(request)}</html>")


def _server_error_with_key_at_the_truncation_point(request: httpx.Request) -> httpx.Response:
    # The log excerpt is cut at 200 characters; the key straddles that point.
    key = request.url.params.get("access_key") or request.headers["x-rapidapi-key"]
    return httpx.Response(500, text="x" * 195 + key + " and more")


def _unauthorized(request: httpx.Request) -> httpx.Response:
    echo = _echo(request)
    return httpx.Response(
        401,
        json={
            "message": echo,
            "error": {
                "code": "invalid_access_key",
                "message": echo,
                "context": {"access_key": request.url.params.get("access_key")},
            },
        },
    )


def _rate_limited(request: httpx.Request) -> httpx.Response:
    echo = _echo(request)
    return httpx.Response(
        429,
        json={"message": echo, "error": {"code": "rate_limit_reached", "message": echo}},
    )


def _rate_limited_without_json(request: httpx.Request) -> httpx.Response:
    return httpx.Response(429, text=_echo(request))


def _quota_error_in_a_200(request: httpx.Request) -> httpx.Response:
    echo = _echo(request)
    return httpx.Response(
        200,
        json={"message": echo, "error": {"code": "usage_limit_reached", "message": echo}},
    )


def _error_object_in_a_200(request: httpx.Request) -> httpx.Response:
    echo = _echo(request)
    return httpx.Response(
        200,
        json={"message": echo, "error": {"code": "invalid_access_key", "message": echo}},
    )


def _malformed_json(request: httpx.Request) -> httpx.Response:
    return httpx.Response(
        200,
        headers={"content-type": "application/json"},
        text='{"data": [{"note": "' + _echo(request),
    )


def _json_of_the_wrong_shape(request: httpx.Request) -> httpx.Response:
    # Valid JSON, but a bare string where an object or a list belongs.
    return httpx.Response(200, json=_echo(request))


def _redirect_echoing_the_url(request: httpx.Request) -> httpx.Response:
    return httpx.Response(302, headers={"location": str(request.url)}, text=_echo(request))


@dataclass(frozen=True)
class FailureMode:
    name: str
    behaviour: Behaviour
    # The status the app answers with...
    status: int
    # ...unless a provider and endpoint are listed here. AeroDataBox has no
    # error-object convention, so an object without the expected fields in a
    # 200 is read as "no flights" for a board and rejected for a lookup.
    status_overrides: dict[tuple[str, str], int] = field(default_factory=dict)
    # What the server log must still say about the failure.
    logged: tuple[str, ...] = ()
    # And what it must say when the provider is AviationStack, whose error
    # objects carry a code.
    logged_for_aviationstack: tuple[str, ...] = ()

    def expected_status(self, provider: str, path: str) -> int:
        return self.status_overrides.get((provider, path), self.status)


_ADB_BOARD = ("aerodatabox", "/api/flights")
_ADB_LOOKUP = ("aerodatabox", "/api/flights/lookup")

FAILURE_MODES = [
    FailureMode(
        "connect-error",
        _connect_error,
        502,
        logged=("ConnectError", "All connection attempts failed", UPSTREAM_MARKER, REDACTED),
    ),
    FailureMode(
        "read-timeout",
        _read_timeout,
        502,
        logged=("ReadTimeout", UPSTREAM_MARKER, REDACTED),
    ),
    FailureMode(
        "500-echoing-the-request",
        _server_error,
        502,
        logged=("status 500", UPSTREAM_MARKER, REDACTED),
    ),
    FailureMode(
        "500-with-the-key-at-the-truncation-point",
        _server_error_with_key_at_the_truncation_point,
        502,
        logged=("status 500",),
    ),
    FailureMode(
        "401-with-an-error-object",
        _unauthorized,
        502,
        logged=("status 401", UPSTREAM_MARKER, REDACTED),
        logged_for_aviationstack=("invalid_access_key",),
    ),
    FailureMode(
        "429-with-a-message",
        _rate_limited,
        429,
        logged=("status 429", UPSTREAM_MARKER, REDACTED),
        logged_for_aviationstack=("rate_limit_reached",),
    ),
    FailureMode(
        "429-without-json",
        _rate_limited_without_json,
        429,
        logged=("status 429", UPSTREAM_MARKER, REDACTED),
    ),
    FailureMode(
        "quota-error-in-a-200",
        _quota_error_in_a_200,
        429,
        status_overrides={_ADB_BOARD: 200, _ADB_LOOKUP: 502},
        logged_for_aviationstack=("status 200", "usage_limit_reached", UPSTREAM_MARKER, REDACTED),
    ),
    FailureMode(
        "error-object-in-a-200",
        _error_object_in_a_200,
        502,
        status_overrides={_ADB_BOARD: 200},
        logged_for_aviationstack=("status 200", "invalid_access_key", UPSTREAM_MARKER, REDACTED),
    ),
    FailureMode(
        "malformed-json",
        _malformed_json,
        502,
        logged=("non-JSON", "status 200", UPSTREAM_MARKER, REDACTED),
    ),
    FailureMode("json-of-the-wrong-shape", _json_of_the_wrong_shape, 502),
    FailureMode(
        "redirect-echoing-the-url",
        _redirect_echoing_the_url,
        502,
        logged=("status 302", UPSTREAM_MARKER, REDACTED),
    ),
]


# --- helpers ----------------------------------------------------------------------


class _Upstream:
    """The mocked provider API. Records what the app sent it."""

    def __init__(self, behaviour: Behaviour) -> None:
        self._behaviour = behaviour
        self.requests: list[httpx.Request] = []

    def _handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return self._behaviour(request)

    def client_factory(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.MockTransport(self._handle))


def _forms_of(key: str) -> set[str]:
    """The key, its encoded spellings, and a prefix of it, so a key cut short
    by truncation counts as a leak too."""
    return {key, quote(key, safe=""), quote_plus(key), key[: max(8, len(key) // 2)]}


def _assert_absent_from_response(forms: set[str], response: httpx.Response) -> None:
    for form in forms:
        assert form not in response.text
        for name, value in response.headers.items():
            assert form not in name
            assert form not in value


def _assert_absent_from_logs(forms: set[str], caplog: pytest.LogCaptureFixture) -> None:
    for form in forms:
        # the formatted output, tracebacks included
        assert form not in caplog.text
        for record in caplog.records:
            assert form not in record.getMessage()
            # the raw record too: message template, arguments, exception
            assert form not in repr(vars(record))


def _key_sent_upstream(provider: str, request: httpx.Request) -> str | None:
    if provider == "aviationstack":
        return request.url.params.get("access_key")
    return request.headers.get("x-rapidapi-key")


# --- every failure mode, both providers, both endpoints -------------------------------


@pytest.mark.parametrize("path", ENDPOINTS)
@pytest.mark.parametrize("mode", FAILURE_MODES, ids=lambda mode: mode.name)
@pytest.mark.parametrize("provider", KEYS)
def test_upstream_failure_leaks_nothing_to_the_response_or_the_log(
    provider: str, mode: FailureMode, path: str, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    key = KEYS[provider]
    upstream = _Upstream(mode.behaviour)
    app = create_app(_settings(provider), http_client_factory=upstream.client_factory)

    with TestClient(app) as client:
        response = client.get(path, params=ENDPOINTS[path])

    # The key really was in play: the app sent it upstream, and the mocked
    # upstream had the chance to echo it.
    assert len(upstream.requests) == 1
    assert _key_sent_upstream(provider, upstream.requests[0]) == key

    expected_status = mode.expected_status(provider, path)
    assert response.status_code == expected_status

    # Nothing of the key, in any spelling, in the body or the headers...
    forms = _forms_of(key)
    _assert_absent_from_response(forms, response)
    # ...and nothing else that came from upstream either.
    assert UPSTREAM_MARKER not in response.text
    assert UPSTREAM_HOST not in response.text
    assert all(UPSTREAM_HOST not in value for value in response.headers.values())

    _assert_absent_from_logs(forms, caplog)

    if expected_status == 200:
        return

    # The client is told which kind of failure it was, and nothing more.
    assert response.json() == {"detail": GENERIC_DETAILS[expected_status]}

    # The server log has one line for the failure, with the useful detail.
    failure_lines = [r for r in caplog.records if r.name == "app.errors"]
    assert len(failure_lines) == 1
    logged = failure_lines[0].getMessage()
    assert f"GET {path}" in logged
    assert f"responding {expected_status}" in logged
    assert failure_lines[0].levelno == (
        logging.WARNING if expected_status == 429 else logging.ERROR
    )
    expected_in_log = mode.logged
    if provider == "aviationstack":
        expected_in_log += mode.logged_for_aviationstack
    for expected in expected_in_log:
        assert expected in logged


@pytest.mark.parametrize("path", ENDPOINTS)
@pytest.mark.parametrize("provider", KEYS)
def test_httpx_request_line_for_an_upstream_call_is_logged_without_the_key(
    provider: str, path: str, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    upstream = _Upstream(_server_error)
    app = create_app(_settings(provider), http_client_factory=upstream.client_factory)

    with TestClient(app) as client:
        client.get(path, params=ENDPOINTS[path])

    upstream_lines = [
        record.getMessage()
        for record in caplog.records
        if record.name == "httpx" and UPSTREAM_HOST in record.getMessage()
    ]
    # httpx logged the upstream request, so there was something to redact
    assert len(upstream_lines) == 1
    assert upstream_lines[0].startswith(f"HTTP Request: GET {BASE_URLS[provider]}")
    if provider == "aviationstack":
        assert f"access_key={REDACTED}" in upstream_lines[0]
    _assert_absent_from_logs(_forms_of(KEYS[provider]), caplog)


@pytest.mark.parametrize("path", ENDPOINTS)
@pytest.mark.parametrize(
    "behaviour", [_connect_error, _server_error, _rate_limited, _malformed_json]
)
def test_key_that_needs_url_encoding_does_not_leak_in_its_encoded_form(
    behaviour: Behaviour, path: str, caplog: pytest.LogCaptureFixture
) -> None:
    # In the URL this key is percent-encoded, so it does not appear there as
    # configured. Both spellings have to be kept out.
    key = "k3y/with+odd &chars=é?"
    caplog.set_level(logging.DEBUG)
    upstream = _Upstream(behaviour)
    app = create_app(
        _settings("aviationstack", aviationstack_api_key=key),
        http_client_factory=upstream.client_factory,
    )

    with TestClient(app) as client:
        response = client.get(path, params=ENDPOINTS[path])

    [request] = upstream.requests
    assert request.url.params["access_key"] == key
    # the exact bytes httpx put on the wire for the key
    [encoded] = [
        pair.split("=", 1)[1]
        for pair in request.url.query.decode("ascii").split("&")
        if pair.startswith("access_key=")
    ]
    assert encoded != key

    forms = _forms_of(key) | {encoded, encoded[:12]}
    assert response.status_code in (429, 502)
    _assert_absent_from_response(forms, response)
    _assert_absent_from_logs(forms, caplog)


def test_successful_response_carries_no_key_either(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.DEBUG)
    upstream = _Upstream(lambda request: httpx.Response(200, json={"data": []}))
    app = create_app(_settings("aviationstack"), http_client_factory=upstream.client_factory)

    with TestClient(app) as client:
        response = client.get("/api/flights", params=ENDPOINTS["/api/flights"])

    assert response.status_code == 200
    forms = _forms_of(KEYS["aviationstack"])
    _assert_absent_from_response(forms, response)
    _assert_absent_from_logs(forms, caplog)


class _CarelessService:
    """A flight service whose provider forgot to redact its error message."""

    def __init__(self, error: Exception) -> None:
        self._error = error

    async def get_flights(self, airport: str, flight_type: str) -> None:
        raise self._error

    async def get_flight_by_number(self, flight_number: str) -> None:
        raise self._error


@pytest.mark.parametrize("path", ENDPOINTS)
@pytest.mark.parametrize("error_type", [ProviderError, RateLimitError])
def test_error_handler_redacts_every_configured_key_itself(
    error_type: type[ProviderError], path: str, caplog: pytest.LogCaptureFixture
) -> None:
    """Providers redact their own key at source. The handler does not rely on
    that: it redacts both configured keys again before it logs."""
    caplog.set_level(logging.DEBUG)
    error = error_type(
        f"{UPSTREAM_MARKER} status 503 for ?access_key={KEYS['aviationstack']} "
        f"and X-RapidAPI-Key: {KEYS['aerodatabox']}"
    )
    upstream = _Upstream(_server_error)
    app = create_app(_settings("aviationstack"), http_client_factory=upstream.client_factory)
    app.dependency_overrides[get_flight_service] = lambda: _CarelessService(error)

    with TestClient(app) as client:
        response = client.get(path, params=ENDPOINTS[path])

    expected_status = 429 if error_type is RateLimitError else 502
    assert response.status_code == expected_status
    assert response.json() == {"detail": GENERIC_DETAILS[expected_status]}
    forms = _forms_of(KEYS["aviationstack"]) | _forms_of(KEYS["aerodatabox"])
    _assert_absent_from_response(forms, response)
    assert UPSTREAM_MARKER not in response.text
    _assert_absent_from_logs(forms, caplog)
    [failure_line] = [r.getMessage() for r in caplog.records if r.name == "app.errors"]
    assert "status 503" in failure_line
    assert failure_line.count(REDACTED) == 2


# --- the exception a provider raises -----------------------------------------------


def _provider(name: str, client: httpx.AsyncClient) -> FlightProvider:
    if name == "aviationstack":
        return AviationStackProvider(
            api_key=KEYS[name], base_url=BASE_URLS[name], client=client
        )
    return AeroDataBoxProvider(api_key=KEYS[name], base_url=BASE_URLS[name], client=client)


@pytest.mark.parametrize("behaviour", [_connect_error, _read_timeout])
@pytest.mark.parametrize("provider_name", KEYS)
def test_network_failure_traceback_does_not_carry_the_key(
    provider_name: str, behaviour: Behaviour
) -> None:
    """The httpx exception holds the request (URL, headers). It must not come
    along as the cause of the ProviderError, where anything that logs a
    traceback would print it."""

    async def run() -> None:
        async with httpx.AsyncClient(transport=httpx.MockTransport(behaviour)) as client:
            await _provider(provider_name, client).get_flights("JFK", "departures")

    with pytest.raises(ProviderError) as exc_info:
        asyncio.run(run())

    error = exc_info.value
    rendered = "".join(traceback.format_exception(error))
    assert error.__cause__ is None
    assert error.__suppress_context__ is True
    for form in _forms_of(KEYS[provider_name]):
        assert form not in str(error)
        assert form not in repr(error)
        assert form not in rendered
    assert REDACTED in str(error)
