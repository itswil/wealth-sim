import { useEffect, useRef, useState } from "react";

export function useMeasuredWidth(minWidth = 320): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(820);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setWidth(Math.max(minWidth, Math.round(el.clientWidth)));
    };
    update();
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? minWidth;
      setWidth(Math.max(minWidth, Math.round(w)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [minWidth]);

  return [ref, width];
}
