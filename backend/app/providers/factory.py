from app.config import Settings
from app.providers.aerodatabox import AeroDataBoxProvider
from app.providers.aviationstack import AviationStackProvider
from app.providers.base import FlightProvider


def build_provider(settings: Settings) -> FlightProvider:
    """Builds the provider named by the FLIGHT_PROVIDER setting."""
    if settings.flight_provider == "aerodatabox":
        return AeroDataBoxProvider(
            api_key=settings.aerodatabox_api_key,
            base_url=settings.aerodatabox_base_url,
        )
    return AviationStackProvider(
        api_key=settings.aviationstack_api_key,
        base_url=settings.aviationstack_base_url,
    )
