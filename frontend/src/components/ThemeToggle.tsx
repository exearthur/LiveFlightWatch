import { IconMoon, IconSun } from "@tabler/icons-react";

import { useTheme } from "../hooks/useTheme";
import { cn } from "../lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground",
        className,
      )}
    >
      {isDark ? (
        <IconSun className="size-[18px]" stroke={1.75} aria-hidden="true" />
      ) : (
        <IconMoon className="size-[18px]" stroke={1.75} aria-hidden="true" />
      )}
    </button>
  );
}

export default ThemeToggle;
