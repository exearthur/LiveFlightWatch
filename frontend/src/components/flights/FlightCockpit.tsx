import { IconPlaneInflight } from "@tabler/icons-react";
import { MotionConfig, motion, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, type ReactNode } from "react";

import { AirlineLogo } from "@/components/flights/AirlineLogo";
import { useNow } from "@/hooks/useNow";
import { STATUS_TONE, delayMinutes, type StatusTone } from "@/lib/flightStatus";
import { formatFlightTime } from "@/lib/flightTime";
import { cn } from "@/lib/utils";
import type { Flight, FlightStatus } from "@/types/flight";

/*
 * The flight-number lookup, drawn as a flight deck: one aircraft's state on a
 * few instruments instead of a row on a board. Every instrument reads a field
 * the API returns; nothing is simulated. In particular the route display
 * places the aircraft by status (at the gate, en route, landed) rather than
 * inventing progress, since the lookup has no arrival time to measure it by.
 */

const TONE_TEXT: Record<StatusTone, string> = {
  ok: "text-board-green",
  warn: "text-board-amber",
  alert: "text-board-red",
  neutral: "text-board-ink",
};

const TONE_LIT: Record<StatusTone, string> = {
  ok: "border-board-green/60 bg-board-green/15 text-board-green",
  warn: "border-board-amber/60 bg-board-amber/15 text-board-amber",
  alert: "border-board-red/60 bg-board-red/15 text-board-red",
  neutral: "border-board-ink/40 bg-board-ink/10 text-board-ink",
};

/** A framed instrument with its name in the corner. */
function Instrument({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={cn("rounded-lg border border-board-line bg-board-raised/50 p-4 sm:p-5", className)}
    >
      <h3 className="mb-3 text-xs text-board-muted">{label}</h3>
      {children}
    </section>
  );
}

// ── Route ────────────────────────────────────────────────────────────

/** Where the aircraft sits on the route line, as a share of its length. */
function routePosition(status: FlightStatus): number {
  if (status === "landed") return 100;
  if (status === "active" || status === "diverted") return 50;
  return 0;
}

function RouteDisplay({ flight, action }: { flight: Flight; action?: ReactNode }) {
  const position = routePosition(flight.status);
  const tone = STATUS_TONE[flight.status];
  const isBroken = flight.status === "cancelled" || flight.status === "diverted";

  return (
    <Instrument label="Route" className="lg:col-span-7">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-3 text-board-muted">
          <AirlineLogo flightNumber={flight.flight_number} airline={flight.airline} />
          <span>{flight.airline ?? "Unknown airline"}</span>
        </p>
        {action}
      </div>
      <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-4">
        <p className="font-mono text-3xl font-semibold text-board-ink sm:text-4xl">
          {flight.origin.iata || "—"}
        </p>

        <div className="relative mx-5 h-10">
          {/* The track. Broken off for a flight that won't fly it as planned. */}
          <div
            className={cn(
              "absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2",
              isBroken ? "border-dashed border-board-red/60" : "border-board-line",
            )}
          />
          {/* Distance covered, filled up to the aircraft. */}
          <motion.div
            className="absolute top-1/2 left-0 h-0.5 origin-left -translate-y-1/2 bg-board-amber"
            style={{ width: "100%" }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: isBroken ? 0 : position / 100 }}
            transition={{ type: "spring", stiffness: 60, damping: 18 }}
          />
          {/* The aircraft, carried by a full-width layer so x is a share of the track. */}
          <motion.div
            className="absolute inset-0"
            initial={{ x: "0%" }}
            animate={{ x: `${position}%` }}
            transition={{ type: "spring", stiffness: 60, damping: 18 }}
          >
            <span
              className={cn(
                "absolute top-1/2 left-0 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-board",
                isBroken ? "border-board-red/60" : "border-board-amber/60",
              )}
            >
              <IconPlaneInflight
                className={cn("size-5", isBroken ? "text-board-red" : "text-board-amber")}
                stroke={1.75}
                aria-hidden="true"
              />
            </span>
          </motion.div>
        </div>

        <p className="font-mono text-3xl font-semibold text-board-ink sm:text-4xl">
          {flight.destination.iata || "—"}
        </p>
      </div>
      <div className="mt-2 flex justify-between gap-6 text-sm">
        <p className="max-w-[45%] text-board-muted">{flight.origin.name ?? ""}</p>
        <p className="max-w-[45%] text-right text-board-muted">{flight.destination.name ?? ""}</p>
      </div>
      <p className={cn("sr-only", TONE_TEXT[tone])}>
        {flight.status === "landed"
          ? "The flight has landed."
          : flight.status === "active"
            ? "The flight is in the air."
            : flight.status === "cancelled"
              ? "The flight is cancelled."
              : flight.status === "diverted"
                ? "The flight has been diverted."
                : "The flight hasn't departed."}
      </p>
    </Instrument>
  );
}

// ── Status annunciator ───────────────────────────────────────────────

const ANNUNCIATOR: FlightStatus[] = [
  "scheduled",
  "active",
  "landed",
  "delayed",
  "diverted",
  "cancelled",
];

function StatusAnnunciator({ status }: { status: FlightStatus }) {
  return (
    <Instrument label="Status" className="lg:col-span-5">
      <p className="sr-only">Status: {status}</p>
      <div aria-hidden="true" className="grid grid-cols-3 gap-2">
        {ANNUNCIATOR.map((light) => {
          const lit = light === status;
          return (
            <div
              key={light}
              className={cn(
                "rounded-md border px-2 py-3 text-center font-mono text-[11px] font-semibold tracking-wide uppercase transition-colors",
                lit ? TONE_LIT[STATUS_TONE[light]] : "border-board-line text-board-muted/45",
              )}
            >
              {light}
            </div>
          );
        })}
      </div>
      {status === "unknown" && (
        <p className="mt-3 text-sm text-board-muted">The provider hasn't reported a status.</p>
      )}
    </Instrument>
  );
}

// ── Delay gauge ──────────────────────────────────────────────────────

const GAUGE_MAX = 120;
const CX = 100;
const CY = 100;
const R = 80;

/** Point on the dial for a number of minutes: 0 at the left, GAUGE_MAX at the right. */
function dialPoint(minutes: number, radius = R): [number, number] {
  const theta = Math.PI - (minutes / GAUGE_MAX) * Math.PI;
  return [CX + radius * Math.cos(theta), CY - radius * Math.sin(theta)];
}

function arc(from: number, to: number): string {
  const [x1, y1] = dialPoint(from);
  const [x2, y2] = dialPoint(to);
  return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
}

function delayTone(minutes: number): StatusTone {
  if (minutes < 15) return "ok";
  if (minutes < 60) return "warn";
  return "alert";
}

const NEEDLE_LENGTH = R - 14;

/**
 * The gauge needle, swung by a spring. Its tip is computed from the angle
 * (0 degrees pointing straight up) rather than rotating the line, so it
 * always pivots on the hub whatever the SVG's size.
 */
function Needle({ rotation, muted }: { rotation: number; muted: boolean }) {
  const reduceMotion = useReducedMotion();
  const angle = useSpring(-90, { stiffness: 70, damping: 12 });
  const x2 = useTransform(angle, (deg) => CX + NEEDLE_LENGTH * Math.sin((deg * Math.PI) / 180));
  const y2 = useTransform(angle, (deg) => CY - NEEDLE_LENGTH * Math.cos((deg * Math.PI) / 180));

  useEffect(() => {
    if (reduceMotion) angle.jump(rotation);
    else angle.set(rotation);
  }, [angle, rotation, reduceMotion]);

  return (
    <motion.line
      x1={CX}
      y1={CY}
      x2={x2}
      y2={y2}
      className={muted ? "stroke-board-muted" : "stroke-board-ink"}
      strokeWidth="3"
      strokeLinecap="round"
    />
  );
}

function DelayGauge({ flight }: { flight: Flight }) {
  const delay = delayMinutes(flight);
  const isCancelled = flight.status === "cancelled";
  const shown = delay === null || isCancelled ? 0 : Math.min(Math.max(delay, 0), GAUGE_MAX);
  const rotation = -90 + (shown / GAUGE_MAX) * 180;
  const tone: StatusTone = isCancelled ? "alert" : delay === null ? "neutral" : delayTone(delay);

  let reading: string;
  if (isCancelled) reading = "Cancelled";
  else if (delay === null) reading = "No estimate yet";
  else if (delay > 0) reading = `${delay} min late`;
  else if (delay < 0) reading = `${-delay} min early`;
  else reading = "On time";

  return (
    <Instrument label="Delay" className="lg:col-span-4">
      <svg viewBox="-14 -8 228 118" className="mx-auto w-full max-w-72" aria-hidden="true">
        {/* Bands: on time, late, very late. */}
        <path d={arc(0, 15)} className="stroke-board-green/40" strokeWidth="8" fill="none" />
        <path d={arc(15, 60)} className="stroke-board-amber/40" strokeWidth="8" fill="none" />
        <path d={arc(60, GAUGE_MAX)} className="stroke-board-red/40" strokeWidth="8" fill="none" />
        {/* A tick every 15 minutes, labelled every 30. */}
        {Array.from({ length: GAUGE_MAX / 15 + 1 }, (_, i) => i * 15).map((m) => {
          const [x1, y1] = dialPoint(m, R - 9);
          const [x2, y2] = dialPoint(m, R - (m % 30 === 0 ? 17 : 13));
          const [lx, ly] = dialPoint(m, R + 11);
          return (
            <g key={m}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-board-muted" strokeWidth="1.5" />
              {m % 30 === 0 && (
                <text
                  x={lx}
                  y={ly + 3}
                  textAnchor="middle"
                  className="fill-board-muted font-mono"
                  fontSize="9"
                >
                  {m}
                </text>
              )}
            </g>
          );
        })}
        <Needle rotation={rotation} muted={delay === null || isCancelled} />
        <circle cx={CX} cy={CY} r="6" className="fill-board-ink" />
      </svg>
      <p className={cn("mt-2 text-center font-mono text-lg font-semibold", TONE_TEXT[tone])}>
        {reading}
      </p>
    </Instrument>
  );
}

// ── Readouts ─────────────────────────────────────────────────────────

function Readout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-md bg-black/30 px-3 py-2.5 shadow-[inset_0_1px_3px_rgb(0_0_0/0.5)]">
      <dt className="text-xs text-board-muted">{label}</dt>
      <dd className="mt-0.5 font-mono text-[15px] text-board-ink">{children}</dd>
    </div>
  );
}

function TimeValue({ value, flight, now }: { value: string | null; flight: Flight; now: number }) {
  const label = formatFlightTime(value, flight.timezone, { now });
  if (!label || !value) return <span className="text-board-muted">—</span>;
  return (
    <>
      <time dateTime={value}>{label.time}</time>
      {label.date && <span className="ml-1.5 text-xs text-board-muted">{label.date}</span>}
    </>
  );
}

/**
 * Which end of the trip the flight's times belong to: a departures board and
 * a lookup give departure times at the origin, an arrivals board gives
 * arrival times at the destination.
 */
export type FlightLeg = "departure" | "arrival";

function Readouts({ flight, leg }: { flight: Flight; leg: FlightLeg }) {
  const now = useNow();
  const localClock = formatFlightTime(new Date(now).toISOString(), flight.timezone, { now });

  return (
    <Instrument label={leg === "arrival" ? "Arrival" : "Departure"} className="lg:col-span-8">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Readout label="Scheduled">
          <TimeValue value={flight.scheduled_time} flight={flight} now={now} />
        </Readout>
        <Readout label="Expected">
          <TimeValue value={flight.estimated_time} flight={flight} now={now} />
        </Readout>
        <Readout label="Actual">
          <TimeValue value={flight.actual_time} flight={flight} now={now} />
        </Readout>
        <Readout label="Terminal">{flight.terminal ?? <span className="text-board-muted">—</span>}</Readout>
        <Readout label="Gate">
          {flight.gate ? (
            <span className="text-board-amber">{flight.gate}</span>
          ) : (
            <span className="text-board-muted">—</span>
          )}
        </Readout>
        <Readout
          label={`Local time at ${(leg === "arrival" ? flight.destination.iata : flight.origin.iata) || "the airport"}`}
        >
          {localClock?.time ?? "—"}
        </Readout>
      </dl>
    </Instrument>
  );
}

// ── The deck ─────────────────────────────────────────────────────────

interface FlightCockpitProps {
  flight: Flight;
  /** Which end of the trip the times describe. Defaults to departure. */
  leg?: FlightLeg;
  /** Shown beside the airline, e.g. a save button. */
  action?: ReactNode;
}

export function FlightCockpit({ flight, leg = "departure", action }: FlightCockpitProps) {
  return (
    // "user": the needle and aircraft jump straight to their reading when
    // the viewer has asked for reduced motion.
    <MotionConfig reducedMotion="user">
      <div className="grid gap-3 p-4 sm:p-6 lg:grid-cols-12">
        <RouteDisplay flight={flight} action={action} />
        <StatusAnnunciator status={flight.status} />
        <DelayGauge flight={flight} />
        <Readouts flight={flight} leg={leg} />
      </div>
    </MotionConfig>
  );
}
