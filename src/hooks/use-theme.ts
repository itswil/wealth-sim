import { useCallback, useEffect, useState } from "react";
import { useMediaQuery } from "./use-media-query";

const STORAGE_KEY = "theme";

type StoredTheme = boolean | null;

function readStoredTheme(): StoredTheme {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark") return true;
  if (stored === "light") return false;
  return null;
}

/**
 * The effective dark-mode state plus a toggle.
 *
 * Until the user makes an explicit choice the OS preference decides, and
 * `useMediaQuery` keeps listening — so changing the system theme updates the
 * app live instead of only applying on first visit. An explicit toggle is
 * persisted and wins from then on.
 *
 * The pre-paint class is applied by the inline script in index.html; the
 * storage key and fallback order must stay in sync with it.
 */
export function useTheme(): [boolean, () => void] {
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const [override, setOverride] = useState<StoredTheme>(readStoredTheme);
  const isDark = override ?? prefersDark;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const toggle = useCallback(() => {
    const next = !isDark;
    setOverride(next);
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
  }, [isDark]);

  return [isDark, toggle];
}
