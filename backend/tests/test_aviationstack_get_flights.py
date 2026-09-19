import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.providers.aviationstack import AviationStackProvider
from app.providers.base import ProviderError, RateLimitError

PROVIDER = AviationStackProvider(api_key="test-key", base_url="https://example.invalid")


def _make_response(status_code: int, json_body=None, text: str = ""):
    response = MagicMock(spec=httpx.Response)
    response.status_code = status_code
    if json_body is not None:
        response.json.return_value = json_body
    else:
        response.json.side_effect = ValueError("no json body")
    response.text = text
    return response


def _run_get_flights(response):
    mock_client = AsyncMock()
    mock_client.get.return_value = response
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None

    with patch("app.providers.aviationstack.httpx.AsyncClient", return_value=mock_client):
        return asyncio.run(PROVIDER.get_flights("JFK", "departures"))


def test_http_429_raises_rate_limit_error():
    response = _make_response(
        429, json_body={"error": {"code": "rate_limit_reached", "message": "Too many requests"}}
    )

    with pytest.raises(RateLimitError, match="Too many requests"):
        _run_get_flights(response)


def test_usage_limit_reached_code_raises_rate_limit_error_even_with_200_status():
    # AviationStack sometimes reports quota errors with a 200 status and an
    # error object in the body rather than a non-200 status code.
    response = _make_response(
        200, json_body={"error": {"code": "usage_limit_reached", "message": "Monthly quota exceeded"}}
    )

    with pytest.raises(RateLimitError, match="Monthly quota exceeded"):
        _run_get_flights(response)


def test_rate_limit_without_json_body_still_raises_rate_limit_error():
    response = _make_response(429, json_body=None, text="rate limited")

    with pytest.raises(RateLimitError):
        _run_get_flights(response)


def test_other_error_code_raises_generic_provider_error_not_rate_limit():
    response = _make_response(
        200, json_body={"error": {"code": "invalid_access_key", "message": "bad key"}}
    )

    with pytest.raises(ProviderError) as exc_info:
        _run_get_flights(response)
    assert not isinstance(exc_info.value, RateLimitError)


def test_non_200_non_rate_limit_status_raises_provider_error():
    response = _make_response(500, json_body=None, text="server error")

    with pytest.raises(ProviderError) as exc_info:
        _run_get_flights(response)
    assert not isinstance(exc_info.value, RateLimitError)


def test_successful_response_returns_flights():
    response = _make_response(200, json_body={"data": []})

    result = _run_get_flights(response)

    assert result == []
