from functools import lru_cache

from fastapi import APIRouter, HTTPException, Query
from typing import Annotated

from app.config import get_settings
from app.core.cache import TTLCache
from app.models.flight import Flight, FlightsResponse, FlightType
from app.providers.aviationstack import AviationStackProvider
from app.providers.base import ProviderError, RateLimitError
from app.services.flight_service import FlightService

router = APIRouter(prefix="/api", tags=["flights"])


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
    except RateLimitError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
