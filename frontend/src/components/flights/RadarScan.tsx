/**
 * Loading state for a flight lookup: a radar sweep over range rings. The
 * sweep only turns when the viewer allows motion; otherwise it holds still.
 */
export function RadarScan({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-5 px-6 py-14 text-center"
    >
      <div className="relative size-40 overflow-hidden rounded-full border border-board-line bg-[radial-gradient(circle,rgb(245_184_61/0.06),transparent_70%)]">
        {/* Range rings and crosshair. */}
        <div className="absolute inset-[20%] rounded-full border border-board-line" />
        <div className="absolute inset-[40%] rounded-full border border-board-line" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-board-line" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-board-line" />
        {/* The sweep: a fading wedge trailing the leading edge. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_280deg,rgb(245_184_61/0.35)_358deg,rgb(245_184_61/0.8)_360deg)] motion-safe:animate-spin"
          style={{ animationDuration: "2.4s" }}
        />
        <div className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-board-amber" />
      </div>
      <p className="text-sm text-board-muted">{label}</p>
    </div>
  );
}
