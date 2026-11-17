from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Query, Request

from app.config import Settings
from app.core.cache import TTLCache
from app.models.flight import (
    FlightLookupResponse,
    FlightSnapshot,
    FlightsResponse,
    FlightType,
)
from app.providers.factory import build_provider
from app.services.flight_service import FlightService

router = APIRouter(prefix="/api", tags=["flights"])

# AviationStack's flight_iata format is typically a 2-3 letter airline code
# followed by a 1-4 digit flight number (e.g. "AA100", "DL2042"), with an
# occasional trailing letter suffix. Validated loosely on purpose.
FLIGHT_NUMBER_PATTERN = "^[A-Za-z]{2,3}[0-9]{1,4}[A-Za-z]?$"


def build_flight_service(settings: Settings, http_client: httpx.AsyncClient) -> FlightService:
    """Builds the service the routes use. Called once, by the app's lifespan,
    with the HTTP client the lifespan owns."""
    provider = build_provider(settings, http_client)
    cache: TTLCache[FlightSnapshot] = TTLCache(
        ttl_seconds=settings.cache_ttl_seconds,
        max_entries=settings.cache_max_entries,
    )
    return FlightService(provider=provider, cache=cache)


def get_flight_service(request: Request) -> FlightService:
    """The service the app's lifespan built at startup.

    There is deliberately no fallback that builds one on demand: that would
    need an HTTP client of its own, outside the lifespan that closes it.
    """
    service = getattr(request.app.state, "flight_service", None)
    if not isinstance(service, FlightService):
        raise RuntimeError(
            "The flight service is not available: it is built by the application "
            "lifespan, which has not run (or has already shut down)."
        )
    return service


FlightServiceDep = Annotated[FlightService, Depends(get_flight_service)]

# Provider failures are not caught here. ProviderError and RateLimitError
# propagate to the handler registered in app/errors.py, which is the single
# place they are mapped to a 502 or 429.


@router.get("/flights", response_model=FlightsResponse)
async def get_flights(
    service: FlightServiceDep,
    airport: Annotated[str, Query(pattern="^[A-Za-z]{3}$")],
    flight_type: Annotated[FlightType, Query(alias="type")] = "departures",
) -> FlightsResponse:
    return await service.get_flights(airport.upper(), flight_type)


@router.get("/flights/lookup", response_model=FlightLookupResponse)
async def get_flight_by_number(
    service: FlightServiceDep,
    flight_number: Annotated[str, Query(pattern=FLIGHT_NUMBER_PATTERN)],
) -> FlightLookupResponse:
    return await service.get_flight_by_number(flight_number.upper())
