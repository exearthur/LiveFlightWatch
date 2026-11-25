from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.config import Settings
from app.core.cache import TTLCache
from app.models.weather import WeatherResponse
from app.providers.aviationweather import AviationWeatherClient
from app.services.weather_service import (
    NoWeatherReportError,
    UnknownAirportError,
    WeatherService,
)

router = APIRouter(prefix="/api", tags=["weather"])

UNKNOWN_AIRPORT_DETAIL = "There is no weather station on record for that airport code."
NO_REPORT_DETAIL = "That airport has no current weather report."


def build_weather_service(settings: Settings, http_client: httpx.AsyncClient) -> WeatherService:
    """Builds the service the route uses. Called once, by the app's lifespan,
    with the HTTP client the lifespan owns."""
    return WeatherService(
        source=AviationWeatherClient(http_client, settings.aviationweather_base_url),
        reports=TTLCache(
            ttl_seconds=settings.weather_cache_ttl_seconds,
            max_entries=settings.cache_max_entries,
        ),
        no_report=TTLCache(
            ttl_seconds=settings.weather_cache_ttl_seconds,
            max_entries=settings.cache_max_entries,
        ),
    )


def get_weather_service(request: Request) -> WeatherService:
    """The service the app's lifespan built at startup (see get_flight_service)."""
    service = getattr(request.app.state, "weather_service", None)
    if not isinstance(service, WeatherService):
        raise RuntimeError(
            "The weather service is not available: it is built by the application "
            "lifespan, which has not run (or has already shut down)."
        )
    return service


WeatherServiceDep = Annotated[WeatherService, Depends(get_weather_service)]


# Upstream failures (ProviderError, RateLimitError) go to the shared handler in
# app/errors.py, like the flight routes'. The two "nothing to show" outcomes
# are a 404 with a message the frontend can print as is.
@router.get("/weather", response_model=WeatherResponse)
async def get_weather(
    service: WeatherServiceDep,
    airport: Annotated[str, Query(pattern="^[A-Za-z]{3}$")],
) -> WeatherResponse:
    try:
        return await service.get_weather(airport)
    except UnknownAirportError:
        raise HTTPException(status_code=404, detail=UNKNOWN_AIRPORT_DETAIL) from None
    except NoWeatherReportError:
        raise HTTPException(status_code=404, detail=NO_REPORT_DETAIL) from None
