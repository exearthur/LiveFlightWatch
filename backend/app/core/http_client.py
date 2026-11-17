"""The one outbound HTTP client the app uses to reach its flight-data provider.

It is created in the FastAPI lifespan (see `app.main`), handed to whichever
provider is selected, and closed on shutdown, so upstream connections are
reused instead of being opened and torn down for every call.
"""

import logging
from collections.abc import Iterator
from contextlib import contextmanager

import httpx

from app.core.redaction import RedactingLogFilter, SecretRedactor

UPSTREAM_TIMEOUT_SECONDS = 10.0

# The loggers httpx and httpcore write to. httpx logs every request as
# `HTTP Request: GET <full url> ...` at INFO, and for AviationStack the full
# URL includes `access_key=...`. httpcore's DEBUG trace lines do not print
# the request target today, but they are covered too rather than relying on
# that. A filter on a logger only sees records logged on that exact logger,
# so each one is named here.
HTTP_LIBRARY_LOGGERS = (
    "httpx",
    "httpcore.connection",
    "httpcore.http11",
    "httpcore.http2",
    "httpcore.proxy",
    "httpcore.socks",
)


def create_http_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=UPSTREAM_TIMEOUT_SECONDS)


@contextmanager
def redacted_http_logs(redactor: SecretRedactor) -> Iterator[None]:
    """While active, strips secrets from everything httpx and httpcore log.

    The request lines stay, minus the key, so they remain useful. This only
    adds a filter to those libraries' loggers; it does not touch handlers,
    formats or levels.
    """
    log_filter = RedactingLogFilter(redactor)
    loggers = [logging.getLogger(name) for name in HTTP_LIBRARY_LOGGERS]
    for logger in loggers:
        logger.addFilter(log_filter)
    try:
        yield
    finally:
        for logger in loggers:
            logger.removeFilter(log_filter)
