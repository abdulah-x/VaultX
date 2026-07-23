"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/**
 * Light/dark switch.
 *
 * The theme is only known on the client, so the icon is rendered as a neutral
 * placeholder until after mount. Rendering the real icon during SSR would emit
 * whichever theme the server guessed and then swap it on hydration, which React
 * reports as a mismatch and the user sees as a flicker.
 */
export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} theme` : "Switch theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md p-2 transition-colors active:scale-95"
    >
      {mounted && !isDark ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}
