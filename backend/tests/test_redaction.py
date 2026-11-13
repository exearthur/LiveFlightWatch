"""SecretRedactor, and the log filter that keeps keys out of what httpx and
httpcore log."""

import asyncio
import logging

import httpx
import pytest

from app.core.http_client import HTTP_LIBRARY_LOGGERS, redacted_http_logs
from app.core.redaction import REDACTED, RedactingLogFilter, SecretRedactor

KEY = "0123456789abcdef0123456789abcdef"


# --- SecretRedactor.redact() ---------------------------------------------------


def test_known_secret_is_replaced_wherever_it_appears() -> None:
    redactor = SecretRedactor([KEY])

    redacted = redactor.redact(f"You supplied an invalid API Access Key [{KEY}], twice: {KEY}")

    assert KEY not in redacted
    assert redacted == f"You supplied an invalid API Access Key [{REDACTED}], twice: {REDACTED}"


def test_every_configured_secret_is_replaced() -> None:
    redactor = SecretRedactor(["first-secret", "second-secret"])

    redacted = redactor.redact("a first-secret and a second-secret")

    assert redacted == f"a {REDACTED} and a {REDACTED}"


def test_percent_encoded_forms_of_a_secret_are_replaced() -> None:
    secret = "k3y with/odd+chars&="
    redactor = SecretRedactor([secret])

    redacted = redactor.redact(
        "path /k3y%20with%2Fodd%2Bchars%26%3D and query ?k=k3y+with%2Fodd%2Bchars%26%3D"
    )

    assert redacted == f"path /{REDACTED} and query ?k={REDACTED}"


def test_a_secret_containing_another_is_replaced_whole() -> None:
    redactor = SecretRedactor(["abc", "abcdef"])

    assert redactor.redact("key abcdef") == f"key {REDACTED}"


def test_blank_secrets_are_ignored() -> None:
    # The unselected provider's key is an empty string. Replacing "" would
    # put the marker between every character.
    redactor = SecretRedactor(["", "   "])

    assert redactor.redact("nothing to hide") == "nothing to hide"


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        pytest.param(
            "GET https://api.example/v1/flights?access_key=whatever-it-is&dep_iata=JFK",
            f"GET https://api.example/v1/flights?access_key={REDACTED}&dep_iata=JFK",
            id="query-parameter",
        ),
        pytest.param(
            "for url 'https://api.example/v1/flights?dep_iata=JFK&access_key=abc%2Fdef'",
            f"for url 'https://api.example/v1/flights?dep_iata=JFK&access_key={REDACTED}'",
            id="last-query-parameter",
        ),
        pytest.param(
            """{"context": {"access_key": "abc123"}}""",
            f"""{{"context": {{"access_key": "{REDACTED}"}}}}""",
            id="json-field",
        ),
        pytest.param(
            "{'x-rapidapi-key': 'abc123', 'x-rapidapi-host': 'h.example'}",
            f"{{'x-rapidapi-key': '{REDACTED}', 'x-rapidapi-host': 'h.example'}}",
            id="header-dict",
        ),
        pytest.param(
            "X-RapidAPI-Key: abc123",
            f"X-RapidAPI-Key: {REDACTED}",
            id="header-line",
        ),
    ],
)
def test_value_of_a_key_bearing_parameter_is_removed_even_if_unknown(
    text: str, expected: str
) -> None:
    # No secret is configured here: the parameter name alone is enough.
    assert SecretRedactor([]).redact(text) == expected


def test_error_codes_that_merely_mention_the_parameter_are_left_alone() -> None:
    text = "{'code': 'invalid_access_key', 'message': 'You have not supplied a valid access_key'}"

    assert SecretRedactor([KEY]).redact(text) == text


def test_redacting_twice_changes_nothing() -> None:
    # A provider redacts its error message, and the error handler redacts it
    # again before logging.
    redactor = SecretRedactor([KEY])
    text = f"GET https://x.example/?access_key={KEY}&dep_iata=JFK failed for key {KEY}"

    once = redactor.redact(text)

    assert once == f"GET https://x.example/?access_key={REDACTED}&dep_iata=JFK failed for key {REDACTED}"
    assert redactor.redact(once) == once


# --- SecretRedactor.excerpt() ----------------------------------------------------


def test_excerpt_redacts_before_truncating_so_no_partial_key_survives() -> None:
    redactor = SecretRedactor([KEY])
    # The key straddles the cut-off point.
    text = "x" * 190 + KEY + " trailing"

    excerpt = redactor.excerpt(text, max_chars=200)

    assert KEY[:6] not in excerpt
    assert excerpt == repr("x" * 190 + REDACTED)


def test_excerpt_limits_length() -> None:
    excerpt = SecretRedactor([]).excerpt("y" * 5000)

    assert excerpt == repr("y" * 200)


def test_excerpt_cannot_forge_log_lines() -> None:
    excerpt = SecretRedactor([]).excerpt("first line\nERROR forged line\r\n")

    assert "\n" not in excerpt
    assert "\r" not in excerpt
    assert excerpt == "'first line\\nERROR forged line\\r\\n'"


# --- RedactingLogFilter ------------------------------------------------------------


def test_log_filter_redacts_message_and_arguments(caplog: pytest.LogCaptureFixture) -> None:
    logger = logging.getLogger("tests.redaction.filter")
    log_filter = RedactingLogFilter(SecretRedactor([KEY]))
    logger.addFilter(log_filter)
    caplog.set_level(logging.DEBUG)

    try:
        logger.info('HTTP Request: %s %s "%s"', "GET", f"https://x.example/?access_key={KEY}", KEY)
    finally:
        logger.removeFilter(log_filter)

    [record] = [r for r in caplog.records if r.name == logger.name]
    assert record.getMessage() == (
        f'HTTP Request: GET https://x.example/?access_key={REDACTED} "{REDACTED}"'
    )
    # the original arguments are gone, so no formatter can bring the key back
    assert record.args is None
    assert KEY not in repr(vars(record))
    assert KEY not in caplog.text


# --- redacted_http_logs() ------------------------------------------------------------


def test_httpx_request_line_is_logged_without_the_key(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.DEBUG)

    async def send() -> None:
        transport = httpx.MockTransport(lambda request: httpx.Response(200, json={}))
        async with httpx.AsyncClient(transport=transport) as client:
            await client.get(
                "https://aviationstack.example.invalid/v1/flights",
                params={"access_key": KEY, "dep_iata": "JFK"},
            )

    with redacted_http_logs(SecretRedactor([KEY])):
        asyncio.run(send())

    request_lines = [r.getMessage() for r in caplog.records if r.name == "httpx"]
    # httpx still logs the request, which is what makes this test meaningful
    assert len(request_lines) == 1
    assert request_lines[0].startswith(
        "HTTP Request: GET https://aviationstack.example.invalid/v1/flights"
        f"?access_key={REDACTED}&dep_iata=JFK"
    )
    assert KEY not in caplog.text
    assert all(KEY not in repr(vars(record)) for record in caplog.records)


def test_httpx_request_line_carries_the_key_without_the_filter(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Pins the httpx behaviour the filter exists for. If this starts failing,
    httpx has stopped logging the full URL and the filter can be revisited."""
    caplog.set_level(logging.DEBUG)

    async def send() -> None:
        transport = httpx.MockTransport(lambda request: httpx.Response(200, json={}))
        async with httpx.AsyncClient(transport=transport) as client:
            await client.get("https://x.example.invalid/", params={"access_key": KEY})

    asyncio.run(send())

    assert KEY in caplog.text


@pytest.mark.parametrize("logger_name", HTTP_LIBRARY_LOGGERS)
def test_every_http_library_logger_is_redacted(
    logger_name: str, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    logger = logging.getLogger(logger_name)

    with redacted_http_logs(SecretRedactor([KEY])):
        logger.debug("send_request_headers.started target=b'/v1/flights?access_key=%s'", KEY)

    [record] = [r for r in caplog.records if r.name == logger_name]
    assert KEY not in record.getMessage()
    assert REDACTED in record.getMessage()


def test_log_filters_are_removed_when_the_context_exits() -> None:
    loggers = [logging.getLogger(name) for name in HTTP_LIBRARY_LOGGERS]
    before = [list(logger.filters) for logger in loggers]

    with redacted_http_logs(SecretRedactor([KEY])):
        assert all(
            any(isinstance(f, RedactingLogFilter) for f in logger.filters) for logger in loggers
        )

    assert [list(logger.filters) for logger in loggers] == before


def test_redacting_http_logs_leaves_levels_and_handlers_alone() -> None:
    loggers = [logging.getLogger(name) for name in ("", *HTTP_LIBRARY_LOGGERS)]
    before = [(logger.level, list(logger.handlers), logger.propagate) for logger in loggers]

    with redacted_http_logs(SecretRedactor([KEY])):
        during = [(logger.level, list(logger.handlers), logger.propagate) for logger in loggers]

    assert during == before
