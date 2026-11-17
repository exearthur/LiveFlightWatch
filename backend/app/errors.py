"""The one place provider failures are turned into HTTP responses.

Clients get a fixed, generic message. What actually went wrong is written to
the server log, with API keys redacted, and never to the response.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.redaction import SecretRedactor
from app.providers.base import ProviderError, RateLimitError

logger = logging.getLogger(__name__)

# The frontend shows its own "quota reached" card for a 429 and prints the
# 502 message under a heading such as "Couldn't load flights", so both are
# written to make sense on their own.
RATE_LIMIT_DETAIL = (
    "The flight-data provider's request limit has been reached. Please try again later."
)
UPSTREAM_FAILURE_DETAIL = (
    "The flight-data provider is unavailable right now. Please try again in a few minutes."
)


def register_error_handlers(app: FastAPI, redactor: SecretRedactor) -> None:
    """Maps `ProviderError` (and its `RateLimitError` subclass) raised by any
    route to a 502 (or 429) with a generic body."""

    async def handle_provider_error(request: Request, exc: Exception) -> JSONResponse:
        if isinstance(exc, RateLimitError):
            status_code, detail, level = 429, RATE_LIMIT_DETAIL, logging.WARNING
        else:
            status_code, detail, level = 502, UPSTREAM_FAILURE_DETAIL, logging.ERROR

        # Providers redact their own key when they build the message; this
        # second pass covers every configured key in case one ever does not.
        # No traceback is logged: it adds nothing for an upstream failure.
        logger.log(
            level,
            "Flight provider failure on %s %s, responding %d: %s",
            request.method,
            request.url.path,
            status_code,
            redactor.redact(str(exc)),
        )
        return JSONResponse(status_code=status_code, content={"detail": detail})

    app.add_exception_handler(ProviderError, handle_provider_error)
