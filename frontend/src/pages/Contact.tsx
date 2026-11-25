import { IconArrowUpRight, IconBrandGithub, IconBug } from "@tabler/icons-react";
import type { ComponentType } from "react";

import { REPO_URL } from "@/lib/links";

const CHANNELS: {
  icon: ComponentType<{ className?: string; stroke?: number; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
  href: string;
}[] = [
  {
    icon: IconBug,
    title: "Report a bug or suggest a feature",
    description: "Open an issue on GitHub. Say what you searched and what you expected to see.",
    href: `${REPO_URL}/issues/new`,
  },
  {
    icon: IconBrandGithub,
    title: "Browse the source",
    description: "See how the board, the cockpit and the API are built, or send a pull request.",
    href: REPO_URL,
  },
];

export default function Contact() {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-8 pb-20 sm:pt-12">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Contact</h1>
      <p className="mt-3 max-w-[58ch] text-lg text-muted-foreground">
        LiveFlightWatch is built and run by one person, so there's no support desk. GitHub is the
        quickest way to get in touch.
      </p>

      <ul className="mt-10 divide-y divide-board-line overflow-hidden rounded-xl bg-board text-board-ink shadow-[0_24px_48px_-24px_rgb(14_16_19/0.55)]">
        {CHANNELS.map(({ icon: Icon, title, description, href }) => (
          <li key={href}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="group flex items-start gap-4 px-5 py-5 transition-colors hover:bg-white/[0.03] sm:px-6"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-board-line text-board-amber">
                <Icon className="size-5" stroke={1.75} aria-hidden={true} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{title}</span>
                <span className="mt-0.5 block text-sm text-board-muted">{description}</span>
              </span>
              <IconArrowUpRight
                className="mt-1 size-5 shrink-0 text-board-muted transition-colors group-hover:text-board-ink"
                stroke={1.75}
                aria-hidden={true}
              />
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-sm text-muted-foreground">
        Links open GitHub in a new tab. Reporting an issue needs a free GitHub account.
      </p>
    </main>
  );
}
