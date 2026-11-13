from functools import lru_cache
from typing import Literal, Self

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.cache import DEFAULT_MAX_ENTRIES

FlightProviderName = Literal["aviationstack", "aerodatabox"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Which upstream flight-data provider to call. Only the selected
    # provider's API key has to be set.
    flight_provider: FlightProviderName = "aviationstack"
    aviationstack_api_key: str = ""
    aviationstack_base_url: str = "https://api.aviationstack.com/v1/flights"
    aerodatabox_api_key: str = ""
    aerodatabox_base_url: str = "https://aerodatabox.p.rapidapi.com"
    cache_ttl_seconds: int = 300
    cache_max_entries: int = Field(default=DEFAULT_MAX_ENTRIES, ge=1)
    cors_origins: str = "http://localhost:5173"

    @model_validator(mode="after")
    def _require_api_key_for_selected_provider(self) -> Self:
        api_key = (
            self.aerodatabox_api_key
            if self.flight_provider == "aerodatabox"
            else self.aviationstack_api_key
        )
        if not api_key.strip():
            raise ValueError(
                f"{self.flight_provider.upper()}_API_KEY must be set "
                f"when FLIGHT_PROVIDER={self.flight_provider}"
            )
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
