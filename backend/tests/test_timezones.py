import importlib.util
import zoneinfo
from collections.abc import Iterator
from datetime import datetime, timedelta

import pytest

from app.providers.timezones import load_zone


@pytest.fixture
def no_system_zone_files() -> Iterator[None]:
    """Hides the host's zone database, leaving only the `tzdata` package, as
    on Windows and in the python:*-slim Docker image."""
    zoneinfo.reset_tzpath(to=[])
    zoneinfo.ZoneInfo.clear_cache()
    try:
        yield
    finally:
        zoneinfo.reset_tzpath()
        zoneinfo.ZoneInfo.clear_cache()


def test_tzdata_package_is_installed() -> None:
    # pinned in requirements.txt; the app must not depend on host zone files
    assert importlib.util.find_spec("tzdata") is not None


@pytest.mark.usefixtures("no_system_zone_files")
def test_zones_load_without_any_system_zone_files() -> None:
    assert zoneinfo.TZPATH == ()

    new_york = load_zone("America/New_York")
    seoul = load_zone("Asia/Seoul")

    assert new_york is not None and seoul is not None
    assert datetime(2026, 12, 1, 12, tzinfo=new_york).utcoffset() == timedelta(hours=-5)
    assert datetime(2026, 7, 1, 12, tzinfo=new_york).utcoffset() == timedelta(hours=-4)
    assert datetime(2026, 7, 1, 12, tzinfo=seoul).utcoffset() == timedelta(hours=9)


def test_load_zone_returns_the_named_zone() -> None:
    zone = load_zone(" Europe/London ")

    assert zone is not None
    assert zone.key == "Europe/London"


@pytest.mark.parametrize(
    "name",
    [None, "", "   ", 5, ["America/New_York"], "Mars/Olympus_Mons", "America", "../etc/passwd", "/etc/localtime"],
)
def test_load_zone_returns_none_for_anything_that_is_not_a_known_zone(name: object) -> None:
    assert load_zone(name) is None
