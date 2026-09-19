from functools import lru_cache

from fastapi import APIRouter, HTTPException, Query
from typing import Annotated

from app.config import get_settings
from app.core.cache import TTLCache
from app.models.flight import Flight, FlightLookupResponse, FlightsResponse, FlightType
from app.providers.aviationstack import AviationStackProvider
from app.providers.base import ProviderError
from app.services.flight_service import FlightService

router = APIRouter(prefix="/api", tags=["flights"])

# AviationStack's flight_iata format is typically a 2-3 letter airline code
# followed by a 1-4 digit flight number (e.g. "AA100", "DL2042"), with an
# occasional trailing letter suffix. Validated loosely on purpose.
FLIGHT_NUMBER_PATTERN = "^[A-Za-z]{2,3}[0-9]{1,4}[A-Za-z]?$"


@lru_cache
def get_flight_service() -> FlightService:
    settings = get_settings()
    provider = AviationStackProvider(
        api_key=settings.aviationstack_api_key,
        base_url=settings.aviationstack_base_url,
    )
    cache: TTLCache[list[Flight]] = TTLCache(ttl_seconds=settings.cache_ttl_seconds)
    return FlightService(provider=provider, cache=cache)


@router.get("/flights", response_model=FlightsResponse)
async def get_flights(
    airport: Annotated[str, Query(pattern="^[A-Za-z]{3}$")],
    flight_type: Annotated[FlightType, Query(alias="type")] = "departures",
) -> FlightsResponse:
    service = get_flight_service()
    try:
        return await service.get_flights(airport.upper(), flight_type)
    except ProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/flights/lookup", response_model=FlightLookupResponse)
async def get_flight_by_number(
    flight_number: Annotated[str, Query(pattern=FLIGHT_NUMBER_PATTERN)],
) -> FlightLookupResponse:
    service = get_flight_service()
    try:
        return await service.get_flight_by_number(flight_number.upper())
    except ProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
