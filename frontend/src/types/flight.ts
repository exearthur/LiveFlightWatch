export type FlightStatus =
  | "scheduled"
  | "active"
  | "landed"
  | "cancelled"
  | "diverted"
  | "delayed"
  | "unknown";

export type FlightDirection = "departures" | "arrivals";

export interface Airport {
  iata: string;
  name: string | null;
}

export interface Flight {
  flight_number: string;
  airline: string | null;
  origin: Airport;
  destination: Airport;
  scheduled_time: string | null;
  estimated_time: string | null;
  actual_time: string | null;
  status: FlightStatus;
  terminal: string | null;
  gate: string | null;
}

export interface FlightsResponse {
  airport: string;
  type: FlightDirection;
  fetched_at: string;
  cached: boolean;
  flights: Flight[];
}

export interface FlightLookupResponse {
  flight_number: string;
  fetched_at: string;
  cached: boolean;
  flights: Flight[];
}
