import type { FlightDirection, FlightsResponse } from "@/types/flight";

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
