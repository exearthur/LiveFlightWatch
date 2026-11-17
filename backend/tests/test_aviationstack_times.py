"""How the AviationStack adapter turns the provider's timestamps into real
instants.

AviationStack labels every leg time `+00:00`, but the digits are the
wall-clock time at that leg's airport. `fixtures/aviationstack_atl_departures.json`
holds four unedited rows of a real response that show it.
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import httpx
import pytest

from app.providers.aviationstack import AviationStackProvider, _to_instant
from app.providers.timezones import load_zone

# Nothing here sends a request, so the client is a placeholder.
PROVIDER = AviationStackProvider(
    api_key="test-key",
    base_url="https://example.invalid",
    client=MagicMock(spec=httpx.AsyncClient),
)

CAPTURE = json.loads(
    (Path(__file__).parent / "fixtures" / "aviationstack_atl_departures.json").read_text(
        encoding="utf-8"
    )
)
CAPTURED_ROWS: dict[str, dict[str, Any]] = {row["flight"]["iata"]: row for row in CAPTURE["data"]}


def _utc(year: int, month: int, day: int, hour: int, minute: int) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc)


def _row(zone: Any, scheduled: Any, **leg_overrides: Any) -> dict[str, Any]:
    leg = {
        "airport": "Hartsfield-jackson Atlanta International",
        "timezone": zone,
        "iata": "ATL",
        "delay": None,
        "scheduled": scheduled,
        "estimated": None,
        "actual": None,
    }
    leg.update(leg_overrides)
    return {
        "flight_status": "scheduled",
        "departure": leg,
        "arrival": {"airport": "Orlando International", "iata": "MCO"},
        "airline": {"name": "Delta Air Lines"},
        "flight": {"iata": "DL2204"},
    }


# --- the captured response ----------------------------------------------------


def test_captured_departure_time_is_read_as_atlanta_wall_clock_not_utc() -> None:
    # DL27, sold here as KE5036: published as a 23:50 EST departure, and the
    # provider sends "2026-11-12T23:50:00+00:00".
    flight = PROVIDER._to_flight(CAPTURED_ROWS["KE5036"], "departures")

    assert flight.scheduled_time == _utc(2026, 11, 13, 4, 50)
    assert flight.actual_time == _utc(2026, 11, 13, 4, 54)
    assert flight.timezone == "America/New_York"


def test_captured_actual_departure_precedes_the_true_utc_position_report() -> None:
    # `live.updated` is real UTC. Read as Atlanta time the take-off is about
    # half an hour before it; read as UTC it would be over five hours before,
    # with the aircraft still over Tennessee.
    row = CAPTURED_ROWS["KE5036"]
    seen_airborne = datetime.fromisoformat(row["live"]["updated"])

    flight = PROVIDER._to_flight(row, "departures")

    assert flight.actual_time is not None
    assert timedelta(0) < seen_airborne - flight.actual_time < timedelta(hours=1)


def test_captured_arrival_time_is_read_in_the_arrival_airports_zone() -> None:
    # The same flight seen from Seoul: "2026-11-14T05:45:00+00:00" is 05:45
    # KST (UTC+9), which makes the block time a plausible 15 h 55 min.
    row = CAPTURED_ROWS["KE5036"]

    departure = PROVIDER._to_flight(row, "departures")
    arrival = PROVIDER._to_flight(row, "arrivals")

    assert arrival.scheduled_time == _utc(2026, 11, 13, 20, 45)
    assert arrival.timezone == "Asia/Seoul"
    assert departure.scheduled_time is not None
    assert arrival.scheduled_time - departure.scheduled_time == timedelta(hours=15, minutes=55)


def test_captured_morning_departures_keep_their_wall_clock_time() -> None:
    flight = PROVIDER._to_flight(CAPTURED_ROWS["DL2204"], "departures")

    # 07:05 EST
    assert flight.scheduled_time == _utc(2026, 11, 13, 12, 5)
    assert flight.estimated_time == _utc(2026, 11, 13, 12, 5)
    assert flight.actual_time is None


def test_captured_block_time_across_zones_only_works_as_local_times() -> None:
    # ATL 07:00 to STL 07:40: forty minutes if both were UTC, a real 1 h 40
    # once each is read in its own zone (Eastern and Central).
    row = CAPTURED_ROWS["WN4625"]

    departure = PROVIDER._to_flight(row, "departures").scheduled_time
    arrival = PROVIDER._to_flight(row, "arrivals").scheduled_time

    assert departure is not None and arrival is not None
    assert arrival - departure == timedelta(hours=1, minutes=40)


def test_delayed_status_still_comes_from_the_providers_delay_minutes() -> None:
    # The rule reads `delay`, not the timestamps, so re-reading the times
    # leaves it alone: 24 minutes late and still airborne is "delayed".
    row = CAPTURED_ROWS["WS6499"]
    assert row["flight_status"] == "active"
    assert row["departure"]["delay"] == 24

    assert PROVIDER._to_flight(row, "departures").status == "delayed"
    # the arrival leg reports no delay, so the same flight is not delayed there
    assert PROVIDER._to_flight(row, "arrivals").status == "active"


def test_flight_number_lookup_uses_the_departure_legs_zone() -> None:
    row = CAPTURED_ROWS["KE5036"]

    flight = PROVIDER._to_flight(row, "departures")

    assert flight.timezone == row["departure"]["timezone"]


def test_times_serialize_as_utc_instants_with_the_display_zone_alongside() -> None:
    flight = PROVIDER._to_flight(CAPTURED_ROWS["KE5036"], "departures")

    body = json.loads(flight.model_dump_json())

    assert body["scheduled_time"] == "2026-11-13T04:50:00Z"
    assert body["actual_time"] == "2026-11-13T04:54:00Z"
    assert body["timezone"] == "America/New_York"


# --- each side of a daylight-saving change --------------------------------------


@pytest.mark.parametrize(
    ("wall_clock", "expected"),
    [
        # summer: EDT, UTC-4
        ("2026-07-01T22:45:00+00:00", _utc(2026, 7, 2, 2, 45)),
        # winter: EST, UTC-5
        ("2026-12-01T22:45:00+00:00", _utc(2026, 12, 2, 3, 45)),
        # the last evening before clocks go back on 1 November 2026, and the first after
        ("2026-10-31T22:45:00+00:00", _utc(2026, 11, 1, 2, 45)),
        ("2026-11-01T22:45:00+00:00", _utc(2026, 11, 2, 3, 45)),
    ],
)
def test_same_wall_clock_time_maps_to_different_instants_across_dst(
    wall_clock: str, expected: datetime
) -> None:
    flight = PROVIDER._to_flight(_row("America/New_York", wall_clock), "departures")

    assert flight.scheduled_time == expected


def test_ambiguous_wall_clock_time_is_read_as_its_first_occurrence() -> None:
    # 01:30 happens twice in New York on 1 November 2026: at 05:30Z (EDT)
    # and again at 06:30Z (EST). The earlier one is used.
    flight = PROVIDER._to_flight(
        _row("America/New_York", "2026-11-01T01:30:00+00:00"), "departures"
    )

    assert flight.scheduled_time == _utc(2026, 11, 1, 5, 30)


def test_wall_clock_time_in_the_skipped_hour_moves_forward_by_the_gap() -> None:
    # 02:30 does not exist in New York on 8 March 2026 (02:00 jumps to
    # 03:00). It is read with the pre-change offset, i.e. as 03:30 EDT.
    flight = PROVIDER._to_flight(
        _row("America/New_York", "2026-03-08T02:30:00+00:00"), "departures"
    )

    assert flight.scheduled_time == _utc(2026, 3, 8, 7, 30)


def test_zone_without_daylight_saving_is_unaffected_by_the_date() -> None:
    summer = PROVIDER._to_flight(_row("Asia/Seoul", "2026-07-01T05:45:00+00:00"), "departures")
    winter = PROVIDER._to_flight(_row("Asia/Seoul", "2026-12-01T05:45:00+00:00"), "departures")

    assert summer.scheduled_time == _utc(2026, 6, 30, 20, 45)
    assert winter.scheduled_time == _utc(2026, 11, 30, 20, 45)


# --- missing or unusable input ---------------------------------------------------


@pytest.mark.parametrize("zone", [None, "", "   ", "Mars/Olympus_Mons", "America", "../etc/passwd", 5])
def test_times_are_dropped_when_the_leg_has_no_usable_zone(
    zone: Any, caplog: pytest.LogCaptureFixture
) -> None:
    # Without the zone the wall-clock digits cannot be placed on the
    # timeline, and passing them through as UTC would show a time that is
    # wrong by the airport's offset.
    row = _row(
        zone,
        "2026-11-12T23:50:00+00:00",
        estimated="2026-11-12T23:55:00+00:00",
        actual="2026-11-12T23:54:00+00:00",
    )

    with caplog.at_level(logging.WARNING, logger="app.providers.aviationstack"):
        flight = PROVIDER._to_flight(row, "departures")

    assert flight.scheduled_time is None
    assert flight.estimated_time is None
    assert flight.actual_time is None
    assert flight.timezone is None
    # the rest of the row still comes through
    assert flight.flight_number == "DL2204"
    assert flight.status == "scheduled"
    assert "no usable time zone" in caplog.text


def test_missing_leg_does_not_break_the_mapping() -> None:
    row = _row("America/New_York", "2026-11-12T23:50:00+00:00")
    row["arrival"] = None

    flight = PROVIDER._to_flight(row, "arrivals")

    assert flight.scheduled_time is None
    assert flight.timezone is None


@pytest.mark.parametrize("value", [None, "", "not a time", 1763000000, "2026-13-45T99:00:00+00:00"])
def test_unparseable_time_becomes_none(value: Any) -> None:
    flight = PROVIDER._to_flight(_row("America/New_York", value), "departures")

    assert flight.scheduled_time is None
    # the zone is still reported, for the row's other times
    assert flight.timezone == "America/New_York"


@pytest.mark.parametrize("value", ["2026-11-12T23:50:00Z", "2026-11-12T23:50:00"])
def test_other_spellings_of_no_offset_are_wall_clock_too(value: str) -> None:
    assert _to_instant(value, load_zone("America/New_York")) == _utc(2026, 11, 13, 4, 50)


def test_value_with_a_real_offset_is_taken_as_the_instant_it_states() -> None:
    # Not something AviationStack sends today. A non-zero offset cannot be
    # the `+00:00` mislabelling, so it is believed, with or without a zone.
    value = "2026-11-12T23:50:00-05:00"

    assert _to_instant(value, load_zone("America/Los_Angeles")) == _utc(2026, 11, 13, 4, 50)
    assert _to_instant(value, None) == _utc(2026, 11, 13, 4, 50)
