from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.core.http_client import create_http_client, redacted_http_logs
from app.core.redaction import SecretRedactor
from app.errors import register_error_handlers
from app.routers.flights import build_flight_service
from app.routers.flights import router as flights_router
from app.routers.weather import build_weather_service
from app.routers.weather import router as weather_router


def create_app(
    settings: Settings,
    http_client_factory: Callable[[], httpx.AsyncClient] = create_http_client,
) -> FastAPI:
    """Builds the application.

    `http_client_factory` is called once, when the app starts, to make the
    HTTP client every upstream call goes through. Tests pass one that
    returns a client with a mocked transport.
    """
    redactor = SecretRedactor([settings.aviationstack_api_key, settings.aerodatabox_api_key])

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        # The log filter goes on before the client exists and comes off
        # after it is closed, so nothing the client logs escapes it.
        with redacted_http_logs(redactor):
            async with http_client_factory() as http_client:
                app.state.http_client = http_client
                app.state.flight_service = build_flight_service(settings, http_client)
                app.state.weather_service = build_weather_service(settings, http_client)
                try:
                    yield
                finally:
                    # Nothing may keep using the client once it is closed.
                    del app.state.weather_service
                    del app.state.flight_service
                    del app.state.http_client

    app = FastAPI(title="LiveFlightWatch API", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_methods=["GET"],
        allow_headers=["*"],
    )

    register_error_handlers(app, redactor)
    app.include_router(flights_router)
    app.include_router(weather_router)
    return app


app = create_app(get_settings())
