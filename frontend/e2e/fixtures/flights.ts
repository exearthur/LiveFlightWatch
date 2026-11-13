// Every response the mocked API can give, typed against the same contract the
// app uses (`src/types/flight.ts`) so a change to that contract fails the type
// check here instead of silently drifting.

import type {
  Airport,
  Flight,
  FlightDirection,
  FlightLookupResponse,
  FlightsResponse,
} from "@/types/flight";

const JFK: Airport = { iata: "JFK", name: "John F Kennedy International" };
const LHR: Airport = { iata: "LHR", name: "London Heathrow" };
const LAX: Airport = { iata: "LAX", name: "Los Angeles International" };
const ATL: Airport = { iata: "ATL", name: "Hartsfield-Jackson Atlanta International" };
const CDG: Airport = { iata: "CDG", name: "Paris Charles de Gaulle" };
const SFO: Airport = { iata: "SFO", name: "San Francisco International" };

// Times are relative to the run so the data never looks like yesterday's
// schedule. The specs deliberately don't assert on them.
function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/** A flight with nothing unusual about it; each fixture overrides what matters. */
function flight(
  overrides: Pick<Flight, "flight_number" | "airline" | "origin" | "destination" | "status"> &
    Partial<Flight>,
): Flight {
  return {
    scheduled_time: minutesFromNow(60),
    estimated_time: minutesFromNow(60),
    actual_time: null,
    terminal: "4",
    gate: "B22",
    ...overrides,
  };
}

/** Departures from JFK: four airlines and five statuses, so filters have something to narrow. */
export const JFK_DEPARTURES: Flight[] = [
  flight({
    flight_number: "AA100",
    airline: "American Airlines",
    origin: JFK,
    destination: LHR,
    status: "scheduled",
    terminal: "8",
    gate: "14",
  }),
  flight({
    flight_number: "AA2345",
    airline: "American Airlines",
    origin: JFK,
    destination: LAX,
    status: "delayed",
    estimated_time: minutesFromNow(105),
    terminal: "8",
    gate: "31",
  }),
  flight({
    flight_number: "DL402",
    airline: "Delta Air Lines",
    origin: JFK,
    destination: ATL,
    status: "active",
    scheduled_time: minutesFromNow(-20),
    estimated_time: minutesFromNow(-15),
    actual_time: minutesFromNow(-12),
  }),
  flight({
    flight_number: "DL88",
    airline: "Delta Air Lines",
    origin: JFK,
    destination: CDG,
    status: "scheduled",
    scheduled_time: minutesFromNow(180),
    estimated_time: minutesFromNow(180),
    gate: null,
  }),
  flight({
    flight_number: "BA178",
    airline: "British Airways",
    origin: JFK,
    destination: LHR,
    status: "cancelled",
    estimated_time: null,
    terminal: "8",
    gate: null,
  }),
  flight({
    flight_number: "UA15",
    airline: "United Airlines",
    origin: JFK,
    destination: SFO,
    status: "landed",
    scheduled_time: minutesFromNow(-400),
    estimated_time: minutesFromNow(-395),
    actual_time: minutesFromNow(-390),
    terminal: "7",
    gate: "6",
  }),
];

/** Arrivals into JFK: no flight number in common with the departures. */
export const JFK_ARRIVALS: Flight[] = [
  flight({
    flight_number: "VS3",
    airline: "Virgin Atlantic",
    origin: LHR,
    destination: JFK,
    status: "landed",
    scheduled_time: minutesFromNow(-30),
    estimated_time: minutesFromNow(-35),
    actual_time: minutesFromNow(-33),
  }),
  flight({
    flight_number: "AF22",
    airline: "Air France",
    origin: CDG,
    destination: JFK,
    status: "active",
    terminal: "1",
    gate: "5",
  }),
  flight({
    flight_number: "B6616",
    airline: "JetBlue Airways",
    origin: SFO,
    destination: JFK,
    status: "scheduled",
    scheduled_time: minutesFromNow(240),
    estimated_time: minutesFromNow(240),
    terminal: "5",
    gate: null,
  }),
];

const FLIGHTS_BY_AIRPORT: Record<string, Record<FlightDirection, Flight[]>> = {
  JFK: { departures: JFK_DEPARTURES, arrivals: JFK_ARRIVALS },
};

/** `GET /api/flights?airport=&type=`. An airport without fixtures has no flights. */
export function flightsResponse(airport: string, type: FlightDirection): FlightsResponse {
  return {
    airport,
    type,
    fetched_at: new Date().toISOString(),
    cached: false,
    flights: FLIGHTS_BY_AIRPORT[airport]?.[type] ?? [],
  };
}

/** `GET /api/flights/lookup?flight_number=`. An unknown flight number has no results. */
export function flightLookupResponse(flightNumber: string): FlightLookupResponse {
  return {
    flight_number: flightNumber,
    fetched_at: new Date().toISOString(),
    cached: false,
    flights: [...JFK_DEPARTURES, ...JFK_ARRIVALS].filter(
      (candidate) => candidate.flight_number === flightNumber,
    ),
  };
}

/** Error bodies, in the `{ detail }` shape FastAPI gives an `HTTPException`. */
export const RATE_LIMITED_BODY = {
  detail: "AviationStack rate limit or monthly quota exceeded",
};
export const INVALID_REQUEST_BODY = { detail: "Invalid query parameters" };
export const NOT_FOUND_BODY = { detail: "Not Found" };
