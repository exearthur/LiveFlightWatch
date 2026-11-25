import type {
  FlightDirection,
  FlightLookupResponse,
  FlightsResponse,
  AirportsResponse,
  PositionResponse,
  WeatherResponse,
} from "@/types/flight";

const API_URL = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function getFlights(
  airport: string,
  type: FlightDirection,
): Promise<FlightsResponse> {
  const response = await fetch(
    `${API_URL}/api/flights?airport=${airport}&type=${type}`,
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      body?.detail ?? `Request failed with status ${response.status}`,
      response.status,
    );
  }

  return response.json();
}

export async function getFlightByNumber(flightNumber: string): Promise<FlightLookupResponse> {
  const response = await fetch(
    `${API_URL}/api/flights/lookup?flight_number=${encodeURIComponent(flightNumber)}`,
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      body?.detail ?? `Request failed with status ${response.status}`,
      response.status,
    );
  }

  return response.json();
}

/** The airport's current weather report (METAR), by IATA code. 404 when it has none. */
export async function getWeather(airport: string): Promise<WeatherResponse> {
  const response = await fetch(`${API_URL}/api/weather?airport=${encodeURIComponent(airport)}`);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      body?.detail ?? `Request failed with status ${response.status}`,
      response.status,
    );
  }

  return response.json();
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      body?.detail ?? `Request failed with status ${response.status}`,
      response.status,
    );
  }
  return response.json();
}

/** The aircraft transmitting a callsign right now, if any. */
export function getPosition(callsign: string): Promise<PositionResponse> {
  return getJson(`/api/position?callsign=${encodeURIComponent(callsign)}`);
}

/** Name and position of each known airport among `codes`; unknown codes are left out. */
export function getAirports(codes: string[]): Promise<AirportsResponse> {
  return getJson(`/api/airports?codes=${encodeURIComponent(codes.join(","))}`);
}
