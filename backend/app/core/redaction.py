"""Keeps provider API keys out of log lines and error messages.

AviationStack takes its key as the `access_key` query parameter, so the key
is part of every upstream URL: it shows up in the string form of httpx
exceptions, in httpx's own request log line, and in any upstream error body
that echoes the request. Anything that may contain upstream text goes
through a `SecretRedactor` before it is logged.
"""

import logging
import re
from collections.abc import Iterable
from urllib.parse import quote, quote_plus

REDACTED = "[REDACTED]"

# How much upstream text (a response body, an exception message) one log
# line may carry.
MAX_EXCERPT_CHARS = 200

# `access_key=...` in a URL or `"X-RapidAPI-Key": "..."` in an echoed request:
# the value is removed whatever it is, so a key in an encoding the exact-value
# pass below does not anticipate is still caught when it sits next to its name.
_NAMED_SECRET = re.compile(
    r"""(?<![A-Za-z0-9_])(access_key|x-rapidapi-key)(["']?\s*[=:]\s*["']?)[^\s"'&,;<>)}\]]+""",
    re.IGNORECASE,
)


class SecretRedactor:
    """Replaces known secret values, and the values of known secret-bearing
    parameters, with a fixed marker."""

    def __init__(self, secrets: Iterable[str]) -> None:
        forms: set[str] = set()
        for secret in secrets:
            if not secret.strip():
                continue
            # The value as configured, and as it appears percent-encoded in a
            # URL path or query string.
            forms.update({secret, quote(secret, safe=""), quote_plus(secret)})
        # Longest first, so a secret that contains a shorter one goes whole.
        self._forms = sorted(forms, key=len, reverse=True)

    def redact(self, text: str) -> str:
        text = _NAMED_SECRET.sub(rf"\1\2{REDACTED}", text)
        for form in self._forms:
            text = text.replace(form, REDACTED)
        return text

    def excerpt(self, text: str, max_chars: int = MAX_EXCERPT_CHARS) -> str:
        """Upstream text made safe to put in a log line.

        Redacted before it is cut, so truncation cannot leave the first half
        of a key behind, and returned as a quoted literal, so line breaks in
        an upstream body cannot forge extra log lines.
        """
        return repr(self.redact(text)[:max_chars])


class RedactingLogFilter(logging.Filter):
    """Rewrites each record's message with secrets removed.

    Attach it to a logger whose messages are written by someone else (see
    `app.core.http_client.redacted_http_logs`). The message is formatted
    here and the arguments dropped, so no handler or formatter downstream
    can see the original values.
    """

    def __init__(self, redactor: SecretRedactor) -> None:
        super().__init__()
        self._redactor = redactor

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = self._redactor.redact(record.getMessage())
        record.args = None
        return True
