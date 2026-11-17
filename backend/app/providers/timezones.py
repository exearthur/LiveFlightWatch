"""Time-zone helpers shared by the provider adapters."""

from typing import Any
from zoneinfo import ZoneInfo


def load_zone(name: Any) -> ZoneInfo | None:
    """The IANA zone called `name`, or None when it is missing, malformed or
    not in the zone database.

    Zone data comes from the pinned `tzdata` package wherever the host has no
    zone files of its own, as on Windows.
    """
    if not isinstance(name, str) or not name.strip():
        return None
    try:
        return ZoneInfo(name.strip())
    except (KeyError, ValueError, OSError):
        # KeyError: no such zone. ValueError: not a legal key ("../etc").
        # OSError: the key names a directory of zones ("America").
        return None
