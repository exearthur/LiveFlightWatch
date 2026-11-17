"""The app owns one outbound HTTP client: created when it starts, shared by
whichever provider is selected, and closed when it shuts down.

Upstream calls go to an httpx MockTransport. Nothing here reaches a real API.
"""

import asyncio
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.core.http_client import UPSTREAM_TIMEOUT_SECONDS, create_http_client
from app.main import app as production_app
from app.main import create_app

PROVIDERS = ["aviationstack", "aerodatabox"]


def _settings(provider: str) -> Settings:
    values: dict[str, Any] = {
        # keeps a developer's local .env out of the test
        "_env_file": None,
        "flight_provider": provider,
        "aviationstack_api_key": "as-test-key",
        "aviationstack_base_url": "https://aviationstack.example.invalid/v1/flights",
        "aerodatabox_api_key": "adb-test-key",
        "aerodatabox_base_url": "https://aerodatabox.example.invalid",
    }
    return Settings(**values)


class _Upstream:
    """A mocked provider API that answers every call with an empty result,
    and records the clients the app asked for and the calls it received."""

    def __init__(self) -> None:
        self.clients: list[httpx.AsyncClient] = []
        self.requests: list[httpx.Request] = []

    def _handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if request.url.host.startswith("aviationstack"):
            return httpx.Response(200, json={"data": []})
        if "/flights/number/" in request.url.path:
            return httpx.Response(200, json=[])
        return httpx.Response(200, json={"departures": [], "arrivals": []})

    def client_factory(self) -> httpx.AsyncClient:
        client = httpx.AsyncClient(
            transport=httpx.MockTransport(self._handle), timeout=UPSTREAM_TIMEOUT_SECONDS
        )
        self.clients.append(client)
        return client


def _app(provider: str) -> tuple[FastAPI, _Upstream]:
    upstream = _Upstream()
    return create_app(_settings(provider), http_client_factory=upstream.client_factory), upstream


@pytest.mark.parametrize("provider", PROVIDERS)
def test_one_client_is_created_at_startup_and_reused_across_requests(provider: str) -> None:
    app, upstream = _app(provider)

    with TestClient(app) as client:
        # created by the lifespan, before any request arrives
        assert len(upstream.clients) == 1

        # four different cache keys, so each request reaches upstream
        responses = [
            client.get("/api/flights", params={"airport": "JFK", "type": "departures"}),
            client.get("/api/flights", params={"airport": "LAX", "type": "arrivals"}),
            client.get("/api/flights/lookup", params={"flight_number": "AA100"}),
            client.get("/api/flights/lookup", params={"flight_number": "DL2042"}),
        ]

        assert [response.status_code for response in responses] == [200, 200, 200, 200]
        # every upstream call went through the one client's transport...
        assert len(upstream.requests) == 4
        # ...and no request made the app ask for another client
        assert len(upstream.clients) == 1
        assert app.state.http_client is upstream.clients[0]
        assert app.state.flight_service._provider._client is upstream.clients[0]


@pytest.mark.parametrize("provider", PROVIDERS)
def test_client_is_closed_on_shutdown(provider: str) -> None:
    app, upstream = _app(provider)

    with TestClient(app) as client:
        client.get("/api/flights", params={"airport": "JFK"})
        assert upstream.clients[0].is_closed is False

    assert upstream.clients[0].is_closed is True
    # nothing is left pointing at the closed client
    assert not hasattr(app.state, "http_client")
    assert not hasattr(app.state, "flight_service")


def test_each_startup_gets_its_own_client_and_closes_it() -> None:
    app, upstream = _app("aviationstack")

    for _ in range(2):
        with TestClient(app) as client:
            assert client.get("/api/flights", params={"airport": "JFK"}).status_code == 200

    assert len(upstream.clients) == 2
    assert upstream.clients[0] is not upstream.clients[1]
    assert [client.is_closed for client in upstream.clients] == [True, True]


def test_request_outside_the_lifespan_fails_instead_of_building_a_client() -> None:
    app, upstream = _app("aviationstack")
    # Not used as a context manager, so the lifespan never runs.
    client = TestClient(app)

    with pytest.raises(RuntimeError, match="lifespan"):
        client.get("/api/flights", params={"airport": "JFK"})

    assert upstream.clients == []
    assert upstream.requests == []


def test_request_after_shutdown_fails_instead_of_using_the_closed_client() -> None:
    app, upstream = _app("aviationstack")
    client = TestClient(app)
    with client:
        pass

    with pytest.raises(RuntimeError, match="lifespan"):
        client.get("/api/flights", params={"airport": "JFK"})

    assert upstream.requests == []


def test_default_client_keeps_the_ten_second_timeout() -> None:
    client = create_http_client()

    try:
        assert UPSTREAM_TIMEOUT_SECONDS == 10.0
        assert client.timeout == httpx.Timeout(10.0)
    finally:
        asyncio.run(client.aclose())


def test_production_app_creates_and_closes_the_default_client() -> None:
    # `app.main.app` is what uvicorn serves. No request is made, so the real
    # client it creates never sends anything.
    with TestClient(production_app):
        http_client = production_app.state.http_client

        assert isinstance(http_client, httpx.AsyncClient)
        assert http_client.timeout == httpx.Timeout(10.0)
        assert http_client.is_closed is False
        assert production_app.state.flight_service._provider._client is http_client

    assert http_client.is_closed is True
