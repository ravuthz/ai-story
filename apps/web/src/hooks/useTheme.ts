import { useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";

const KEY = "theme";
const DEFAULT_THEME: Theme = "dark";
const media = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();

const read = (): Theme => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" || v === "system" ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};

let current = read();

export const resolveTheme = (theme: Theme): "light" | "dark" => (theme === "system" ? (media.matches ? "dark" : "light") : theme);

const apply = () => void document.documentElement.classList.toggle("dark", resolveTheme(current) === "dark");

function setTheme(theme: Theme) {
  current = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Storage unavailable (private mode): theme still applies for this session.
  }
  apply();
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  media.addEventListener("change", l);
  return () => {
    listeners.delete(l);
    media.removeEventListener("change", l);
  };
};

/** Light / dark / system theme, persisted per browser and applied as the `dark` class on <html>. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current);
  const resolved = useSyncExternalStore(subscribe, () => resolveTheme(current));
  // Re-apply when the OS preference flips while on "system".
  useEffect(apply, [theme, resolved]);
  return { theme, resolved, setTheme };
}
