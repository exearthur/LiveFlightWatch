from app.providers.aviationstack import AviationStackProvider, _clean

PROVIDER = AviationStackProvider(api_key="test-key", base_url="https://example.invalid")


def _raw_flight(**overrides):
    raw = {
        "flight_date": "2026-09-18",
        "flight_status": "active",
        "departure": {
            "airport": "John F Kennedy International",
            "iata": "JFK",
            "terminal": "4",
            "gate": "B22",
            "delay": 5,
            "scheduled": "2026-09-18T10:00:00+00:00",
            "estimated": "2026-09-18T10:05:00+00:00",
            "actual": None,
        },
        "arrival": {
            "airport": "Los Angeles International",
            "iata": "LAX",
            "terminal": "B",
            "gate": None,
            "delay": None,
            "scheduled": "2026-09-18T13:00:00+00:00",
            "estimated": None,
            "actual": None,
        },
        "airline": {"name": "Delta Air Lines", "iata": "DL"},
        "flight": {"number": "123", "iata": "DL123"},
    }
    raw.update(overrides)
    return raw


# --- _clean() -----------------------------------------------------------


def test_clean_returns_none_for_none():
    assert _clean(None) is None


def test_clean_passes_through_real_value():
    assert _clean("Delta Air Lines") == "Delta Air Lines"


def test_clean_normalizes_placeholder_strings_to_none():
    for placeholder in ["", "n/a", "N/A", "na", "NA", "unknown", "empty", "none", "null", "  empty  "]:
        assert _clean(placeholder) is None, f"expected {placeholder!r} to be cleaned to None"


# --- _to_flight(): departures --------------------------------------------


def test_to_flight_maps_departure_fields():
    flight = PROVIDER._to_flight(_raw_flight(), "departures")

    assert flight.flight_number == "DL123"
    assert flight.airline == "Delta Air Lines"
    assert flight.origin.iata == "JFK"
    assert flight.origin.name == "John F Kennedy International"
    assert flight.destination.iata == "LAX"
    assert flight.destination.name == "Los Angeles International"
    assert flight.terminal == "4"
    assert flight.gate == "B22"
    assert flight.scheduled_time is not None
    assert flight.estimated_time is not None
    assert flight.actual_time is None
    assert flight.status == "active"


# --- _to_flight(): arrivals -----------------------------------------------


def test_to_flight_maps_arrival_fields_using_arrival_leg():
    flight = PROVIDER._to_flight(_raw_flight(), "arrivals")

    # for arrivals, terminal/gate/times come from the arrival leg, not departure
    assert flight.terminal == "B"
    assert flight.gate is None
    assert flight.status == "active"


# --- status normalization --------------------------------------------------


def test_delay_over_threshold_marks_scheduled_flight_as_delayed():
    raw = _raw_flight(flight_status="scheduled")
    raw["departure"]["delay"] = 20

    flight = PROVIDER._to_flight(raw, "departures")

    assert flight.status == "delayed"


def test_delay_over_threshold_marks_active_flight_as_delayed():
    raw = _raw_flight(flight_status="active")
    raw["departure"]["delay"] = 16

    flight = PROVIDER._to_flight(raw, "departures")

    assert flight.status == "delayed"


def test_delay_at_or_under_threshold_does_not_mark_delayed():
    raw = _raw_flight(flight_status="scheduled")
    raw["departure"]["delay"] = 15

    flight = PROVIDER._to_flight(raw, "departures")

    assert flight.status == "scheduled"


def test_delay_does_not_override_non_scheduled_active_status():
    # a landed flight with a big recorded delay should stay "landed",
    # not be reclassified as "delayed"
    raw = _raw_flight(flight_status="landed")
    raw["departure"]["delay"] = 45

    flight = PROVIDER._to_flight(raw, "departures")

    assert flight.status == "landed"


def test_unmapped_raw_status_becomes_unknown():
    raw = _raw_flight(flight_status="incident")

    flight = PROVIDER._to_flight(raw, "departures")

    assert flight.status == "unknown"


def test_missing_raw_status_becomes_unknown():
    raw = _raw_flight()
    del raw["flight_status"]

    flight = PROVIDER._to_flight(raw, "departures")

    assert flight.status == "unknown"


# --- placeholder normalization ----------------------------------------------


def test_placeholder_airline_name_normalized_to_none():
    raw = _raw_flight()
    raw["airline"]["name"] = "empty"

    flight = PROVIDER._to_flight(raw, "departures")

    assert flight.airline is None


def test_placeholder_airport_name_normalized_to_none():
    raw = _raw_flight()
    raw["departure"]["airport"] = "unknown"

    flight = PROVIDER._to_flight(raw, "departures")

    assert flight.origin.name is None


def test_placeholder_terminal_and_gate_normalized_to_none():
    raw = _raw_flight()
    raw["departure"]["terminal"] = "n/a"
    raw["departure"]["gate"] = "N/A"

    flight = PROVIDER._to_flight(raw, "departures")

    assert flight.terminal is None
    assert flight.gate is None


def test_flight_number_falls_back_from_iata_to_number():
    raw = _raw_flight()
    raw["flight"]["iata"] = "empty"
    raw["flight"]["number"] = "456"

    flight = PROVIDER._to_flight(raw, "departures")

    assert flight.flight_number == "456"


def test_flight_number_falls_back_to_unknown_when_both_placeholders():
    raw = _raw_flight()
    raw["flight"]["iata"] = "empty"
    raw["flight"]["number"] = "unknown"

    flight = PROVIDER._to_flight(raw, "departures")

    assert flight.flight_number == "Unknown"
