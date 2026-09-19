import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">
        Live Flight Watch
      </h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        A universal flight table for any airport in the world — check departures and
        arrivals without waiting on the slow board at the gate.
      </p>
      <Button asChild>
        <Link to="/flights">View Live Flights</Link>
      </Button>
    </div>
  );
}
