// Widths of the placeholder bars, matching the board's columns:
// scheduled, flight, place, airline, expected, gate, status.
const COLUMN_WIDTHS = ["w-20", "w-14", "w-36", "w-28", "w-20", "w-12", "w-16"];
const ROWS = 8;

function Bar({ className, delay }: { className: string; delay: number }) {
  return (
    <div
      className={`h-3 animate-pulse rounded-sm bg-board-raised ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

/** Board-shaped placeholder shown while the first response for a board loads. */
export function FlightsTableSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading flights">
      <div className="hidden md:block">
        <div className="flex gap-8 border-b border-board-line px-6 py-3.5">
          {COLUMN_WIDTHS.map((_, idx) => (
            <Bar key={idx} className="w-14 opacity-60" delay={idx * 30} />
          ))}
        </div>
        {Array.from({ length: ROWS }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex gap-8 border-b border-board-line/70 px-6 py-[18px]">
            {COLUMN_WIDTHS.map((width, colIdx) => (
              <Bar
                key={colIdx}
                className={width}
                delay={(rowIdx * COLUMN_WIDTHS.length + colIdx) * 25}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="divide-y divide-board-line/70 md:hidden">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className="space-y-2.5 px-4 py-4">
            <div className="flex justify-between">
              <Bar className="w-16" delay={idx * 40} />
              <Bar className="w-14" delay={idx * 40 + 20} />
            </div>
            <Bar className="w-40" delay={idx * 40 + 40} />
            <Bar className="w-28" delay={idx * 40 + 60} />
          </div>
        ))}
      </div>
    </div>
  );
}
