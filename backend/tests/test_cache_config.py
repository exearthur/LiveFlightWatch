from typing import Any

import pytest
from pydantic import ValidationError

import app.routers.flights as flights_router_module
from app.config import Settings
from app.core.cache import DEFAULT_MAX_ENTRIES


def _settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "aviationstack_api_key": "test-api-key",
        # keeps a developer's local .env from leaking into the test
        "_env_file": None,
        **overrides,
    }
    return Settings(**values)


def test_cache_max_entries_defaults_to_cache_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("CACHE_MAX_ENTRIES", raising=False)

    assert _settings().cache_max_entries == DEFAULT_MAX_ENTRIES


def test_cache_max_entries_is_read_from_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CACHE_MAX_ENTRIES", "7")

    assert _settings().cache_max_entries == 7


@pytest.mark.parametrize("max_entries", [0, -5])
def test_cache_max_entries_below_one_is_rejected(max_entries: int) -> None:
    with pytest.raises(ValidationError, match="cache_max_entries"):
        _settings(cache_max_entries=max_entries)


def test_flight_service_cache_is_built_with_configured_max_entries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        flights_router_module,
        "get_settings",
        lambda: _settings(cache_max_entries=3),
    )

    # __wrapped__ bypasses lru_cache so the app-wide service is left untouched
    service = flights_router_module.get_flight_service.__wrapped__()

    assert service._cache.max_entries == 3
