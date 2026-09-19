const COLUMN_WIDTHS = ["w-16", "w-28", "w-32", "w-14", "w-14", "w-20", "w-20"];

export function FlightsTableSkeleton() {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-neutral-200 shadow-sm md:block dark:border-neutral-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr>
              {COLUMN_WIDTHS.map((_, idx) => (
                <th key={idx} className="px-4 py-3">
                  <div className="h-3 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {Array.from({ length: 8 }).map((_, rowIdx) => (
              <tr key={rowIdx}>
                {COLUMN_WIDTHS.map((width, colIdx) => (
                  <td key={colIdx} className="px-4 py-3">
                    <div
                      className={`h-3 ${width} animate-pulse rounded bg-neutral-200 dark:bg-neutral-800/70`}
                      style={{ animationDelay: `${(rowIdx * COLUMN_WIDTHS.length + colIdx) * 30}ms` }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {Array.from({ length: 6 }).map((_, cardIdx) => (
          <div
            key={cardIdx}
            className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div
                  className="h-3.5 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800"
                  style={{ animationDelay: `${cardIdx * 40}ms` }}
                />
                <div
                  className="h-3 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800/70"
                  style={{ animationDelay: `${cardIdx * 40 + 20}ms` }}
                />
              </div>
              <div
                className="h-5 w-16 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800"
                style={{ animationDelay: `${cardIdx * 40 + 40}ms` }}
              />
            </div>

            <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
              <div
                className="h-3 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800/70"
                style={{ animationDelay: `${cardIdx * 40 + 60}ms` }}
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
              {[0, 1, 2].map((colIdx) => (
                <div
                  key={colIdx}
                  className="h-3 w-14 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800/70"
                  style={{ animationDelay: `${cardIdx * 40 + 80 + colIdx * 20}ms` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
