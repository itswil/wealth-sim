import { useEffect, useState, type RefObject } from "react";

/**
 * True while the element behind `ref` really does clip content below the fold.
 *
 * A scroll container capped by `max-height` changes neither its own box nor its
 * own `scrollHeight` event source when its content grows, so the element is
 * observed alongside its first child: the child grows when a section opens,
 * the element grows when the viewport resizes. Used to show a "more below"
 * cue only when there is actually more below.
 */
export function useHasOverflow(ref: RefObject<HTMLElement | null>): boolean {
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => setHasOverflow(el.scrollHeight > el.clientHeight + 1);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [ref]);

  return hasOverflow;
}
