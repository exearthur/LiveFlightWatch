import { Filter, Info, Moon, Radar, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Radar,
    title: "Live flight status",
    description:
      "Departures and arrivals are pulled straight from AviationStack, so the board reflects what's actually happening right now.",
  },
  {
    icon: Filter,
    title: "Airline & status filtering",
    description:
      "Narrow a busy airport's schedule down to one airline, or focus on scheduled, active, delayed, landed, cancelled, or diverted flights.",
  },
  {
    icon: Moon,
    title: "Light & dark mode",
    description:
      "Follows your system preference out of the box, with a manual toggle in the navbar if you want to override it.",
  },
  {
    icon: Smartphone,
    title: "Works on your phone",
    description:
      "The layout is responsive from the start, so checking a gate board works just as well on mobile as on a desktop.",
  },
];

export default function About() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-sky-600/10 text-sky-600 dark:text-sky-400">
          <Info className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            About
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            What Live Flight Watch is, and why it exists.
          </p>
        </div>
      </div>

      <div className="space-y-4 text-neutral-600 dark:text-neutral-400">
        <p>
          Live Flight Watch is a universal flight tracker — pick any airport in the world by
          its IATA code and see its live departures and arrivals, without waiting on the slow
          board at the gate or digging through an airline's own site.
        </p>
        <p>
          Under the hood it's a small FastAPI backend that proxies the{" "}
          <a
            href="https://aviationstack.com/"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-sky-600 underline underline-offset-2 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
          >
            AviationStack
          </a>{" "}
          API, paired with a React frontend built to make that data easy to search and filter.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <span className="mb-3 flex size-8 items-center justify-center rounded-lg bg-sky-600/10 text-sky-600 dark:text-sky-400">
              <Icon className="size-4" />
            </span>
            <h3 className="font-medium text-neutral-900 dark:text-neutral-100">{title}</h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Live Flight Watch is a personal, solo-built project — not a company or a team. It
          exists because a universal, no-nonsense flight board seemed worth building, and it
          doubles as a portfolio piece.
        </p>
      </div>

      <div className="mt-8 flex justify-center">
        <Button asChild>
          <Link to="/flights">View Live Flights</Link>
        </Button>
      </div>
    </div>
  );
}
