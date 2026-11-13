import httpx

from app.config import Settings
from app.providers.aerodatabox import AeroDataBoxProvider
from app.providers.aviationstack import AviationStackProvider
from app.providers.base import FlightProvider


def build_provider(settings: Settings, client: httpx.AsyncClient) -> FlightProvider:
    """Builds the provider named by the FLIGHT_PROVIDER setting.

    `client` is the app's shared HTTP client. The provider sends every
    request through it and never closes it; whoever created it does that.
    """
    if settings.flight_provider == "aerodatabox":
        return AeroDataBoxProvider(
            api_key=settings.aerodatabox_api_key,
            base_url=settings.aerodatabox_base_url,
            client=client,
        )
    return AviationStackProvider(
        api_key=settings.aviationstack_api_key,
        base_url=settings.aviationstack_base_url,
        client=client,
    )
