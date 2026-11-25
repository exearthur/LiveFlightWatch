import { lazy, Suspense, type ReactNode } from "react";

import { AircraftPhoto } from "@/components/flights/AircraftPhoto";
import { Instrument, Readout } from "@/components/flights/Instrument";
import { useNow } from "@/hooks/useNow";
import { useAirports, usePosition } from "@/hooks/usePosition";
import { ApiError } from "@/lib/api";
import { formatAltitude, formatSpeed } from "@/lib/position";
import { timeAgo } from "@/lib/timeAgo";
import { heading } from "@/lib/weather";
import type { Flight } from "@/types/flight";

// MapLibre is large, so the map is only downloaded when one is shown.
const LiveMap = lazy(() => import("@/components/flights/LiveMap"));

/** Statuses in which the aircraft may be in the air, and worth looking for. */
const AIRBORNE_STATUSES = new Set(["active", "diverted"]);

function Message({ children }: { children: ReactNode }) {
  return <p className="max-w-[60ch] text-sm text-board-muted">{children}</p>;
}

function MapPlaceholder() {
  return <div aria-hidden="true" className="h-full min-h-72 w-full animate-pulse rounded-md bg-board-raised" />;
}

/** Why there is no map for a flight that isn't in the air. */
function groundedMessage(flight: Flight): string {
  switch (flight.status) {
    case "landed":
      return "This flight has landed, so it's no longer tracked live.";
    case "cancelled":
      return "This flight is cancelled.";
    case "scheduled":
    case "delayed":
      return "The live map appears once the flight takes off.";
    default:
      return "There's no live position while the flight's status is unknown.";
  }
}

/**
 * Where the aircraft is right now, on a map along its route, with its
 * altitude, speed and heading, and a photo of the airframe. Positions are
 * only looked up for a flight that is in the air: the source allows a few
 * hundred requests a day for the whole site.
 */
export function LivePosition({ flight }: { flight: Flight }) {
  const airborne = AIRBORNE_STATUSES.has(flight.status);
  const { data, isLoading, error } = usePosition(flight.callsign, airborne);
  const airports = useAirports(airborne ? [flight.origin.iata, flight.destination.iata] : []);
  const now = useNow(5_000);
  const aircraft = data?.aircraft ?? null;

  let body: ReactNode;
  if (!airborne) {
    body = <Message>{groundedMessage(flight)}</Message>;
  } else if (!flight.callsign) {
    body = (
      <Message>
        The flight-data provider didn't give this flight's radio callsign, so it can't be found
        on the live map.
      </Message>
    );
  } else if (isLoading) {
    body = (
      <div className="h-72">
        <MapPlaceholder />
      </div>
    );
  } else if (error) {
    body = (
      <Message>
        {error instanceof ApiError && error.status === 429
          ? "Live tracking has used its requests for today. It starts again tomorrow."
          : "The live position isn't available right now."}
      </Message>
    );
  } else if (!aircraft) {
    body = (
      <Message>
        No aircraft is broadcasting {flight.callsign} right now. It may be outside receiver
        coverage, over an ocean for example, or flying under a different callsign.
      </Message>
    );
  } else {
    const find = (code: string) => airports.data?.airports.find((airport) => airport.iata === code);
    const label = [aircraft.type_name ?? aircraft.type_code, aircraft.registration].filter(Boolean).join(", ");
    body = (
      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="h-72 lg:h-auto lg:min-h-80">
          <Suspense fallback={<MapPlaceholder />}>
            <LiveMap
              aircraft={aircraft}
              origin={find(flight.origin.iata)}
              destination={find(flight.destination.iata)}
            />
          </Suspense>
        </div>
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-2">
            <Readout label="Altitude">{formatAltitude(aircraft.altitude_ft, aircraft.on_ground)}</Readout>
            <Readout label="Heading">{aircraft.track_deg === null ? "—" : heading(aircraft.track_deg)}</Readout>
            <div className="col-span-2">
              <Readout label="Ground speed">{formatSpeed(aircraft.ground_speed_kt)}</Readout>
            </div>
            <div className="col-span-2">
              <Readout label="Aircraft">
                <span className="font-sans text-sm">{label || "Unknown type"}</span>
              </Readout>
            </div>
          </dl>
          <AircraftPhoto hex={aircraft.hex} label={label || flight.callsign} />
        </div>
      </div>
    );
  }

  return (
    <Instrument
      label="Live position"
      className="lg:col-span-12"
      aside={
        aircraft && data ? (
          <span className="text-xs text-board-muted">
            {flight.callsign} · updated {timeAgo(data.fetched_at, now)}
          </span>
        ) : undefined
      }
    >
      {body}
    </Instrument>
  );
}
