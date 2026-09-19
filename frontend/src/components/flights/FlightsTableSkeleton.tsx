const COLUMN_WIDTHS = ["w-16", "w-28", "w-32", "w-14", "w-14", "w-20", "w-20"];

export function FlightsTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-sm dark:border-neutral-800">
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
  );
}
