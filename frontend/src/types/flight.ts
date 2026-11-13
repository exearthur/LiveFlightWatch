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
  /** The three times are ISO 8601 instants (UTC), not airport wall-clock values. */
  scheduled_time: string | null;
  estimated_time: string | null;
  actual_time: string | null;
  status: FlightStatus;
  terminal: string | null;
  gate: string | null;
  /**
   * The zone to show the times in, that of the airport they belong to: an
   * IANA name ("America/New_York") or a fixed offset ("-05:00"). Null when
   * the provider does not say, and absent from responses older than the field.
   */
  timezone?: string | null;
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
