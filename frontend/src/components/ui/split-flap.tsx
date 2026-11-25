import { motion, useReducedMotion } from "motion/react";
import { memo, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/*
 * A row of split-flap characters, as on an airport departures board.
 *
 * Adapted from Aceternity UI's "Text Flipping Board" (via 21st.dev): its
 * per-cell flap animation is kept, while the 6x22 message grid, the random
 * colour tiles and the light theme are dropped. Each cell scrambles through a
 * few characters before landing on its target, with a delay per column so the
 * text settles left to right.
 *
 * The cells are hidden from assistive technology; the component exposes the
 * real text once, through `aria-label`, so a screen reader doesn't spell out
 * every intermediate flap.
 */

const FLAP_CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/:.";
const FLIP_SECONDS = 0.3;
const STEP_MS = 60;
const COLUMN_DELAY_MS = 70;

const SIZES = {
  md: { cell: "h-11 w-8 text-xl", gap: "gap-1" },
  lg: { cell: "h-16 w-11 text-3xl", gap: "gap-1.5" },
  xl: { cell: "h-20 w-14 text-4xl sm:h-24 sm:w-16 sm:text-5xl", gap: "gap-1.5 sm:gap-2" },
} as const;

type FlapSize = keyof typeof SIZES;

function normalize(char: string): string {
  const upper = char.toUpperCase();
  return FLAP_CHARS.includes(upper) ? upper : " ";
}

const halfText =
  "absolute inset-x-0 flex h-[200%] items-center justify-center font-mono font-semibold select-none";

const FlapCell = memo(function FlapCell({
  target,
  delay,
  size,
  reduceMotion,
}: {
  target: string;
  delay: number;
  size: FlapSize;
  reduceMotion: boolean;
}) {
  const [current, setCurrent] = useState(reduceMotion ? target : " ");
  const [previous, setPrevious] = useState(" ");
  const [flipId, setFlipId] = useState(0);
  const currentRef = useRef(current);

  useEffect(() => {
    if (reduceMotion) {
      currentRef.current = target;
      setCurrent(target);
      return;
    }
    if (target === currentRef.current) return;

    // A blank cell settles quickly; a character scrambles a little longer so
    // the wave across the row reads as mechanical rather than instant.
    const steps = target === " " ? 3 : 6 + Math.floor(Math.random() * 5);
    let step = 0;
    let timer: ReturnType<typeof setTimeout>;

    const flip = () => {
      step += 1;
      const isLast = step >= steps;
      const next = isLast
        ? target
        : FLAP_CHARS[1 + Math.floor(Math.random() * (FLAP_CHARS.length - 1))];
      setPrevious(currentRef.current);
      currentRef.current = next;
      setCurrent(next);
      setFlipId((id) => id + 1);
      if (!isLast) timer = setTimeout(flip, STEP_MS);
    };

    timer = setTimeout(flip, delay);
    return () => clearTimeout(timer);
  }, [target, delay, reduceMotion]);

  const show = current === " " ? " " : current;
  const showPrevious = previous === " " ? " " : previous;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[4px] bg-board-raised text-board-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.05),0_1px_0_rgb(0_0_0/0.6)]",
        SIZES[size].cell,
      )}
      style={{ perspective: "300px" }}
    >
      {/* New character, top half. */}
      <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden">
        <div className={cn(halfText, "top-0")}>{show}</div>
      </div>
      {/* New character, bottom half, slightly darker like a real flap. */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden bg-black/15">
        <div className={cn(halfText, "bottom-0")}>{show}</div>
      </div>

      {flipId > 0 && (
        <>
          {/* Old character's top half falls away. */}
          <motion.div
            key={`top-${flipId}`}
            className="absolute inset-x-0 top-0 z-10 h-1/2 origin-bottom overflow-hidden bg-board-raised backface-hidden"
            initial={{ rotateX: 0 }}
            animate={{ rotateX: -90 }}
            transition={{ duration: FLIP_SECONDS, ease: [0.55, 0.055, 0.675, 0.19] }}
          >
            <div className={cn(halfText, "top-0")}>{showPrevious}</div>
          </motion.div>
          {/* New character's bottom half drops into place. */}
          <motion.div
            key={`bottom-${flipId}`}
            className="absolute inset-x-0 bottom-0 z-10 h-1/2 origin-top overflow-hidden bg-board-raised backface-hidden"
            initial={{ rotateX: 90 }}
            animate={{ rotateX: 0 }}
            transition={{
              duration: FLIP_SECONDS * 0.8,
              delay: FLIP_SECONDS * 0.5,
              ease: [0.33, 1.4, 0.64, 1],
            }}
          >
            <div className={cn(halfText, "bottom-0 bg-black/15")}>{show}</div>
          </motion.div>
        </>
      )}

      {/* The hinge between the two flaps. */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 h-px -translate-y-1/2 bg-black/70" />
    </div>
  );
});

interface SplitFlapProps {
  text: string;
  /** Pads with blank flaps so the board keeps its width as the text changes. */
  length?: number;
  size?: FlapSize;
  className?: string;
}

export function SplitFlap({ text, length, size = "lg", className }: SplitFlapProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const width = Math.max(length ?? 0, text.length);
  const chars = Array.from(text.padEnd(width, " ").slice(0, width), normalize);

  return (
    <div role="img" aria-label={text} className={cn("flex", SIZES[size].gap, className)}>
      {chars.map((char, index) => (
        <FlapCell
          key={index}
          target={char}
          delay={index * COLUMN_DELAY_MS}
          size={size}
          reduceMotion={reduceMotion}
        />
      ))}
    </div>
  );
}
