import * as Dialog from "@radix-ui/react-dialog";
import { IconX } from "@tabler/icons-react";

import { FlightCockpit, type FlightLeg } from "@/components/flights/FlightCockpit";
import { SaveFlightButton } from "@/components/flights/SaveFlightButton";
import { SplitFlap } from "@/components/ui/split-flap";
import type { Flight } from "@/types/flight";

interface FlightDrawerProps {
  /** The flight to show; the drawer is closed when this is undefined. */
  flight: Flight | undefined;
  leg: FlightLeg;
  onClose: () => void;
}

function describe(flight: Flight, leg: FlightLeg): string {
  const from = flight.origin.name ?? flight.origin.iata;
  const to = flight.destination.name ?? flight.destination.iata;
  return leg === "arrival" ? `Arriving from ${from}` : `Departing to ${to}`;
}

/**
 * A flight from the board, opened in the cockpit. It slides over the board
 * from the right (from the bottom on phones) and is drawn entirely from the
 * board's own data, so opening it costs no API call.
 */
export function FlightDrawer({ flight, leg, onClose }: FlightDrawerProps) {
  return (
    <Dialog.Root open={!!flight} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgb(14_16_19/0.55)] backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-xl bg-board text-board-ink shadow-[0_-24px_48px_-24px_rgb(0_0_0/0.6)] data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom motion-reduce:animate-none md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[min(56rem,92vw)] md:rounded-t-none md:rounded-l-xl md:data-[state=closed]:slide-out-to-right md:data-[state=open]:slide-in-from-right"
        >
          {flight && (
            <>
              <div className="flex items-center gap-4 border-b border-board-line px-4 py-4 sm:px-6">
                <SplitFlap text={flight.flight_number} length={6} size="md" className="hidden sm:flex" />
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="truncate text-lg font-semibold">
                    {flight.airline ? `${flight.airline} ${flight.flight_number}` : flight.flight_number}
                  </Dialog.Title>
                  <Dialog.Description className="truncate text-sm text-board-muted">
                    {describe(flight, leg)}
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  aria-label="Close"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-board-line text-board-ink transition-colors hover:border-board-muted/60"
                >
                  <IconX className="size-4" stroke={1.75} aria-hidden="true" />
                </Dialog.Close>
              </div>
              <div className="overflow-y-auto">
                <FlightCockpit flight={flight} leg={leg} action={<SaveFlightButton flight={flight} />} />
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
