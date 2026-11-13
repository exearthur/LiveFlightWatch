from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.cache import DEFAULT_MAX_ENTRIES


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    aviationstack_api_key: str
    aviationstack_base_url: str = "https://api.aviationstack.com/v1/flights"
    cache_ttl_seconds: int = 300
    cache_max_entries: int = Field(default=DEFAULT_MAX_ENTRIES, ge=1)
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
