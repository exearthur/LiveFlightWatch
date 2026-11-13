from typing import Any

import pytest
from pydantic import ValidationError

import app.routers.flights as flights_router_module
from app.config import Settings
from app.providers.aerodatabox import AeroDataBoxProvider
from app.providers.aviationstack import AviationStackProvider
from app.providers.factory import build_provider

_PROVIDER_ENV_VARS = (
    "FLIGHT_PROVIDER",
    "AVIATIONSTACK_API_KEY",
    "AERODATABOX_API_KEY",
    "AERODATABOX_BASE_URL",
)


@pytest.fixture(autouse=True)
def _clean_provider_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Each test states the provider settings it needs, so neither the
    key conftest.py sets nor a developer's shell can decide the outcome."""
    for name in _PROVIDER_ENV_VARS:
        monkeypatch.delenv(name, raising=False)


def _settings(**overrides: Any) -> Settings:
    # _env_file=None keeps a developer's local .env out of the test
    values: dict[str, Any] = {"_env_file": None, **overrides}
    return Settings(**values)


# --- the FLIGHT_PROVIDER setting ---------------------------------------------


def test_flight_provider_defaults_to_aviationstack() -> None:
    settings = _settings(aviationstack_api_key="as-key")

    assert settings.flight_provider == "aviationstack"


def test_flight_provider_is_read_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FLIGHT_PROVIDER", "aerodatabox")
    monkeypatch.setenv("AERODATABOX_API_KEY", "adb-key")

    settings = _settings()

    assert settings.flight_provider == "aerodatabox"
    assert settings.aerodatabox_api_key == "adb-key"


def test_unknown_flight_provider_is_rejected() -> None:
    with pytest.raises(ValidationError, match="flight_provider"):
        _settings(flight_provider="opensky", aviationstack_api_key="as-key")


def test_default_provider_still_requires_the_aviationstack_key() -> None:
    with pytest.raises(ValidationError, match="AVIATIONSTACK_API_KEY must be set"):
        _settings()


def test_default_provider_does_not_need_an_aerodatabox_key() -> None:
    settings = _settings(aviationstack_api_key="as-key")

    assert settings.aerodatabox_api_key == ""


def test_aerodatabox_requires_its_own_key() -> None:
    with pytest.raises(ValidationError, match="AERODATABOX_API_KEY must be set"):
        _settings(flight_provider="aerodatabox", aviationstack_api_key="as-key")


def test_blank_key_counts_as_missing() -> None:
    with pytest.raises(ValidationError, match="AERODATABOX_API_KEY must be set"):
        _settings(flight_provider="aerodatabox", aerodatabox_api_key="   ")


def test_aerodatabox_does_not_need_an_aviationstack_key() -> None:
    settings = _settings(flight_provider="aerodatabox", aerodatabox_api_key="adb-key")

    assert settings.aviationstack_api_key == ""


# --- build_provider() ----------------------------------------------------------


def test_build_provider_returns_aviationstack_by_default() -> None:
    provider = build_provider(_settings(aviationstack_api_key="as-key"))

    assert isinstance(provider, AviationStackProvider)
    assert provider._api_key == "as-key"
    assert provider._base_url == "https://api.aviationstack.com/v1/flights"


def test_build_provider_returns_aerodatabox_when_selected() -> None:
    provider = build_provider(
        _settings(flight_provider="aerodatabox", aerodatabox_api_key="adb-key")
    )

    assert isinstance(provider, AeroDataBoxProvider)
    assert provider._headers["X-RapidAPI-Key"] == "adb-key"
    assert provider._headers["X-RapidAPI-Host"] == "aerodatabox.p.rapidapi.com"
    assert provider._base_url == "https://aerodatabox.p.rapidapi.com"


def test_build_provider_ignores_the_unselected_providers_key() -> None:
    provider = build_provider(
        _settings(aviationstack_api_key="as-key", aerodatabox_api_key="adb-key")
    )

    assert isinstance(provider, AviationStackProvider)


# --- the flight service the routes use -------------------------------------------


def test_flight_service_uses_aviationstack_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        flights_router_module,
        "get_settings",
        lambda: _settings(aviationstack_api_key="as-key"),
    )

    # __wrapped__ bypasses lru_cache so the app-wide service is left untouched
    service = flights_router_module.get_flight_service.__wrapped__()

    assert isinstance(service._provider, AviationStackProvider)


def test_flight_service_uses_the_provider_selected_in_the_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FLIGHT_PROVIDER", "aerodatabox")
    monkeypatch.setenv("AERODATABOX_API_KEY", "adb-key")
    monkeypatch.setattr(flights_router_module, "get_settings", _settings)

    service = flights_router_module.get_flight_service.__wrapped__()

    assert isinstance(service._provider, AeroDataBoxProvider)
