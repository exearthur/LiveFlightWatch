from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.config import Settings
from app.core.airport_codes import airport_for_iata
from app.core.cache import TTLCache
from app.models.position import AirportsResponse, PositionResponse
from app.providers.adsblol import AdsbLolClient
from app.services.position_service import PositionService

router = APIRouter(prefix="/api", tags=["position"])

# An ICAO airline designator (three letters) and a flight number, with up to
# two trailing letters: "DAL27", "BAW178A".
CALLSIGN_PATTERN = "^[A-Za-z]{3}[0-9]{1,4}[A-Za-z]{0,2}$"
MAX_AIRPORT_CODES = 10


def build_position_service(settings: Settings, http_client: httpx.AsyncClient) -> PositionService:
    """Builds the service the route uses. Called once, by the app's lifespan,
    with the HTTP client the lifespan owns."""
    return PositionService(
        source=AdsbLolClient(http_client, settings.adsblol_base_url),
        cache=TTLCache(
            ttl_seconds=settings.position_cache_ttl_seconds,
            max_entries=settings.cache_max_entries,
        ),
    )


def get_position_service(request: Request) -> PositionService:
    """The service the app's lifespan built at startup (see get_flight_service)."""
    service = getattr(request.app.state, "position_service", None)
    if not isinstance(service, PositionService):
        raise RuntimeError(
            "The position service is not available: it is built by the application "
            "lifespan, which has not run (or has already shut down)."
        )
    return service


PositionServiceDep = Annotated[PositionService, Depends(get_position_service)]


# Upstream failures go to the shared handler in app/errors.py. No aircraft
# transmitting the callsign is a normal answer (200 with aircraft: null), not
# an error: most flights spend most of the day on the ground.
@router.get("/position", response_model=PositionResponse)
async def get_position(
    service: PositionServiceDep,
    callsign: Annotated[str, Query(pattern=CALLSIGN_PATTERN)],
) -> PositionResponse:
    return await service.get_position(callsign)


@router.get("/airports", response_model=AirportsResponse)
async def get_airports(
    codes: Annotated[str, Query(description="Comma-separated IATA codes, e.g. JFK,LHR")],
) -> AirportsResponse:
    requested = [code.strip().upper() for code in codes.split(",") if code.strip()]
    if not requested or len(requested) > MAX_AIRPORT_CODES:
        raise HTTPException(
            status_code=422, detail=f"Give between 1 and {MAX_AIRPORT_CODES} airport codes."
        )
    found = [airport for code in dict.fromkeys(requested) if (airport := airport_for_iata(code))]
    return AirportsResponse(airports=found)
