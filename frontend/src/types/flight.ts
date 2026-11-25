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
  /**
   * The radio callsign ("DAL27"), which live-position lookups key on. For a
   * codeshare it is the operating flight's. Null or absent when unknown.
   */
  callsign?: string | null;
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

/** Flight rules from ceiling and visibility: visual, marginal visual, instrument, low instrument. */
export type FlightCategory = "VFR" | "MVFR" | "IFR" | "LIFR";

export interface CloudLayer {
  /** METAR cover code: FEW, SCT, BKN, OVC, or CLR/SKC/NSC/CAVOK for clear. */
  cover: string;
  base_ft: number | null;
}

/** A decoded METAR. Fields the report leaves out are null. */
export interface Weather {
  station: string;
  station_name: string | null;
  observed_at: string;
  raw: string;
  flight_category: FlightCategory | null;
  temperature_c: number | null;
  dewpoint_c: number | null;
  /** Direction the wind blows from, degrees true; null when calm or variable. */
  wind_direction_deg: number | null;
  wind_variable: boolean;
  wind_speed_kt: number | null;
  wind_gust_kt: number | null;
  /** Statute miles as reported; "10+" means ten or more. */
  visibility_sm: string | null;
  altimeter_hpa: number | null;
  clouds: CloudLayer[];
}

export interface WeatherResponse {
  airport: string;
  fetched_at: string;
  cached: boolean;
  weather: Weather;
}

/** An aircraft's latest ADS-B report. */
export interface Aircraft {
  /** 24-bit ICAO transponder address, six hex digits. */
  hex: string;
  callsign: string;
  registration: string | null;
  /** ICAO type designator, e.g. "B38M". */
  type_code: string | null;
  type_name: string | null;
  lat: number;
  lon: number;
  altitude_ft: number | null;
  on_ground: boolean;
  ground_speed_kt: number | null;
  /** Direction of travel over the ground, degrees true. */
  track_deg: number | null;
  position_age_s: number | null;
}

export interface PositionResponse {
  callsign: string;
  fetched_at: string;
  cached: boolean;
  /** Null when nothing is transmitting the callsign right now. */
  aircraft: Aircraft | null;
}

export interface AirportLocation {
  iata: string;
  icao: string;
  name: string | null;
  lat: number;
  lon: number;
}

export interface AirportsResponse {
  airports: AirportLocation[];
}
