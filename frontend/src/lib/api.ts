import type { FlightDirection, FlightLookupResponse, FlightsResponse } from "@/types/flight";

const API_URL = import.meta.env.VITE_API_URL;

export async function getFlights(
  airport: string,
  type: FlightDirection,
): Promise<FlightsResponse> {
  const response = await fetch(
    `${API_URL}/api/flights?airport=${airport}&type=${type}`,
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed with status ${response.status}`);
  }

  return response.json();
}

export async function getFlightByNumber(flightNumber: string): Promise<FlightLookupResponse> {
  const response = await fetch(
    `${API_URL}/api/flights/lookup?flight_number=${encodeURIComponent(flightNumber)}`,
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed with status ${response.status}`);
  }

  return response.json();
}
