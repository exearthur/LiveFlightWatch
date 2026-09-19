import { ExternalLink, Github, MessageSquare, MessagesSquare } from "lucide-react";

const REPO_URL = "https://github.com/exearthur/LiveFlightWatch";

const LINKS = [
  {
    icon: Github,
    title: "GitHub",
    description: "Browse the source, star the repo, or send a pull request.",
    href: REPO_URL,
  },
  {
    icon: MessagesSquare,
    title: "Report an issue",
    description: "Found a bug or have an idea for a feature? Open an issue on GitHub.",
    href: `${REPO_URL}/issues`,
  },
];

export default function Contact() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-sky-600/10 text-sky-600 dark:text-sky-400">
          <MessageSquare className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            Contact
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Questions, bugs, or feedback — here's where to reach out.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {LINKS.map(({ icon: Icon, title, description, href }) => (
          <a
            key={title}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 transition-colors hover:border-sky-600/40 hover:bg-sky-600/5 dark:border-neutral-800 dark:hover:border-sky-400/40 dark:hover:bg-sky-400/5"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-sky-600/10 text-sky-600 dark:text-sky-400">
              <Icon className="size-4" />
            </span>
            <div>
              <h3 className="flex items-center gap-1.5 font-medium text-neutral-900 dark:text-neutral-100">
                {title}
                <ExternalLink className="size-3.5 text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100" />
              </h3>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
            </div>
          </a>
        ))}
      </div>

      <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
        This is a solo-built project without a dedicated support team, so GitHub is the most
        reliable way to reach the developer.
      </p>
    </div>
  );
}
