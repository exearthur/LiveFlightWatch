import { IconMenu2, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { name: "Flights", to: "/", end: true },
  { name: "Favorites", to: "/favorites", end: false },
  { name: "About", to: "/about", end: false },
  { name: "Contact", to: "/contact", end: false },
];

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    "rounded-md px-3 py-1.5 text-sm transition-colors",
    isActive
      ? "bg-foreground/[0.07] font-semibold text-foreground"
      : "text-muted-foreground hover:text-foreground",
  );
}

/** The wordmark: the product name set like a short board code. */
function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="LiveFlightWatch home">
      <span
        aria-hidden="true"
        className="flex h-7 items-center rounded-[4px] bg-board px-1.5 font-mono text-xs font-semibold tracking-wider text-board-amber"
      >
        LFW
      </span>
      <span className="font-semibold tracking-tight">LiveFlightWatch</span>
    </Link>
  );
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Wordmark />

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={navLinkClass}>
              {link.name}
            </NavLink>
          ))}
          <ThemeToggle className="ml-2" />
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="inline-flex size-9 items-center justify-center rounded-md text-foreground hover:bg-foreground/[0.07]"
          >
            {menuOpen ? <IconX className="size-5" /> : <IconMenu2 className="size-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t border-border px-4 py-2 md:hidden"
        >
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  "block rounded-md px-3 py-2.5",
                  isActive ? "font-semibold text-foreground" : "text-muted-foreground",
                )
              }
            >
              {link.name}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
