import { IconArrowRight } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { REPO_URL } from "@/lib/links";

/** A stop on the route: a board-style code, then what happens there. */
function Stop({
  code,
  title,
  last = false,
  children,
}: {
  code: string;
  title: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="relative grid grid-cols-[3.5rem_1fr] gap-x-5 pb-10 last:pb-0">
      {/* The line to the next stop. */}
      {!last && (
        <span aria-hidden="true" className="absolute top-9 bottom-0 left-7 w-px bg-border" />
      )}
      <span
        aria-hidden="true"
        className="relative flex h-9 items-center justify-center rounded-[4px] bg-board font-mono text-sm font-semibold tracking-wider text-board-amber"
      >
        {code}
      </span>
      <div className="pt-1">
        <h3 className="font-semibold">{title}</h3>
        <div className="mt-1 max-w-[62ch] text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-foreground underline decoration-foreground/30 underline-offset-[3px] transition-colors hover:decoration-foreground"
    >
      {children}
    </a>
  );
}

const CREDITS: { name: string; href: string; role: string }[] = [
  { name: "AviationStack", href: "https://aviationstack.com/", role: "Departures, arrivals and flight status" },
  {
    name: "Aviation Weather Center",
    href: "https://aviationweather.gov/",
    role: "Airport weather reports (METAR), from the US National Weather Service",
  },
  {
    name: "adsb.lol",
    href: "https://adsb.lol/",
    role: "Live aircraft positions, from a community network of receivers (ODbL)",
  },
  { name: "Planespotters.net", href: "https://www.planespotters.net/", role: "Aircraft photos, credited to each photographer" },
  {
    name: "OpenFreeMap",
    href: "https://openfreemap.org/",
    role: "Map tiles, with map data from OpenStreetMap contributors",
  },
  { name: "OurAirports", href: "https://ourairports.com/data/", role: "Airport codes and locations, released into the public domain" },
  { name: "Travelpayouts", href: "https://www.travelpayouts.com/", role: "Airline logo images" },
  {
    name: "Aceternity UI",
    href: "https://ui.aceternity.com/",
    role: "The split-flap animation, adapted from its Text Flipping Board",
  },
  { name: "Tabler Icons", href: "https://tabler.io/icons", role: "Icons" },
];

export default function About() {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-8 pb-20 sm:pt-12">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">About LiveFlightWatch</h1>
      <p className="mt-3 max-w-[62ch] text-lg text-muted-foreground">
        A live flight board for any airport, and a cockpit view for any single flight. It's a solo
        student project, built to learn how a real data product fits together, from the API it
        depends on to the screen you read it on.
      </p>

      <section aria-labelledby="how-it-works" className="mt-14">
        <h2 id="how-it-works" className="text-xl font-semibold">
          How a search travels
        </h2>
        <p className="mt-1 max-w-[62ch] text-muted-foreground">
          Every board you open makes the same three-stop trip.
        </p>

        <ol className="mt-8">
          <Stop code="YOU" title="Your browser">
            The React app keeps your search in the address bar, so you can share it or go back to
            it. It asks for fresh data every 45 seconds while a board is open, and keeps your
            favorites in this browser, not on a server.
          </Stop>
          <Stop code="LFW" title="The LiveFlightWatch API">
            A small FastAPI service that holds the API keys and remembers each board for five
            minutes and each weather report for ten. Everyone looking at the same airport shares
            one call to the data source, which keeps the site inside its free limits.
          </Stop>
          <Stop code="SRC" title="The data sources" last>
            Flights come from AviationStack, weather from the Aviation Weather Center, and live
            positions of planes in the air from adsb.lol. Times arrive as exact instants and are
            shown in each airport's own time zone.
          </Stop>
        </ol>
      </section>

      <section aria-labelledby="good-to-know" className="mt-14">
        <h2 id="good-to-know" className="text-xl font-semibold">
          Good to know
        </h2>
        <ul className="mt-4 max-w-[62ch] list-disc space-y-2 pl-5 text-muted-foreground marker:text-foreground/30">
          <li>
            Flight data runs on a free plan with a small monthly request limit. If it runs out, the
            board says so and waits until it resets.
          </li>
          <li>
            Status, gates and estimates are only as current as the airline reports them, so check
            with your airline before heading to the airport.
          </li>
          <li>Airline logos belong to their airlines and are shown to identify them.</li>
        </ul>
      </section>

      <section aria-labelledby="credits" className="mt-14">
        <h2 id="credits" className="text-xl font-semibold">
          Credits
        </h2>
        <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-[auto_1fr]">
          {CREDITS.map((credit) => (
            <div key={credit.name} className="contents">
              <dt>
                <ExternalLink href={credit.href}>{credit.name}</ExternalLink>
              </dt>
              <dd className="-mt-3 text-muted-foreground sm:mt-0">{credit.role}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link
          to="/"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Find flights
          <IconArrowRight className="size-4" stroke={2} aria-hidden="true" />
        </Link>
        <ExternalLink href={REPO_URL}>Read the source on GitHub</ExternalLink>
      </div>
    </main>
  );
}
