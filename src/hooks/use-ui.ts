import { useCallback, useEffect, useRef, useState } from "react";

export function useTheme(): [boolean, () => void] {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  const toggle = useCallback(() => setIsDark((v) => !v), []);
  return [isDark, toggle];
}

export function useMeasuredWidth(minWidth = 320): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(820);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? minWidth;
      setWidth(Math.max(minWidth, Math.round(w)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [minWidth]);

  return [ref, width];
}
