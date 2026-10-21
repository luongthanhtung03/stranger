"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useState } from "react";
import { flushSync } from "react-dom";
import { KEY, THEME_COLOR, type Theme } from "./theme-script";

// Dark is the default ("Neon night"); light is opt-in and remembered per device.
// The pre-paint script in layout.tsx applies the stored value before React runs.

export type { Theme };

function stored(): Theme {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function apply(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

interface Ctx {
  theme: Theme;
  /** Switches theme; `origin` is where the reveal circle grows from. */
  toggle: (origin?: { x: number; y: number }) => void;
}

const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  // Syncs state with the pre-paint script, and re-applies the attribute after
  // React's dev remount clears it. A no-op in production.
  useLayoutEffect(() => {
    const t = stored();
    apply(t);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(t);
  }, []);

  const toggle = useCallback((origin?: { x: number; y: number }) => {
    const next: Theme = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode: still switches for this session */
    }
    const swap = () => {
      apply(next);
      flushSync(() => setTheme(next));
    };

    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return swap();
    if (!document.startViewTransition) {
      // Fallback: cross-fade colors instead of the circular reveal.
      root.classList.add("theme-fade");
      swap();
      setTimeout(() => root.classList.remove("theme-fade"), 450);
      return;
    }
    const x = origin?.x ?? window.innerWidth - 40;
    const y = origin?.y ?? 40;
    root.style.setProperty("--reveal-x", `${x}px`);
    root.style.setProperty("--reveal-y", `${y}px`);
    root.style.setProperty("--reveal-r", `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
    document.startViewTransition(swap);
  }, []);

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme outside ThemeProvider");
  return ctx;
}
