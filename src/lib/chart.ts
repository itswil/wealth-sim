export const CHART_LAYOUT = {
  height: 320,
  paddingLeft: 74,
  paddingRight: 18,
  paddingTop: 14,
  paddingBottom: 28,
} as const;

export interface YScale {
  lo: number;
  hi: number;
  span: number;
  /**
   * Whether the axis is actually logarithmic. A log axis cannot represent a
   * series whose maximum is not positive, so `makeYScale` silently falls back
   * to linear there — read this rather than the caller's requested mode to
   * decide which ticks to draw.
   */
  log: boolean;
  transform: (v: number) => number;
}

export function makeYScale(
  minV: number,
  maxV: number,
  logScale: boolean,
  minPositive?: number,
): YScale {
  // Log10 is undefined at or below zero, so a population that is entirely in
  // debt (or entirely at zero) has no log axis to draw: every value would clamp
  // to the floor and flatten the series into a single line. Fall back to linear
  // and report it, so callers do not label the axis as logarithmic anyway.
  const log = logScale && maxV > 0;
  // Sit the floor on the smallest positive value in the data so every year of
  // the run stays in view — a floor expressed as a fraction of the peak hides
  // the early decades under a single flat line. The `maxV * 1e-12` term caps
  // the window at twelve decades, so a stray near-zero balance cannot stretch
  // the axis until the real range is a few pixels tall.
  const floor = log
    ? Math.max(
        Math.min(minPositive && minPositive > 0 ? minPositive : maxV * 1e-12, maxV),
        maxV * 1e-12,
        1,
      )
    : 0;
  const lo = log ? Math.log10(floor) : minV;
  const hi = log ? Math.log10(Math.max(maxV, floor)) : maxV;
  return {
    lo,
    hi,
    span: hi - lo || 1,
    log,
    transform: (v) => (log ? Math.log10(Math.max(v, floor)) : v),
  };
}

export const makeY =
  ({ lo, span, transform }: YScale, pt: number, innerH: number) =>
  (v: number) =>
    pt + (1 - (transform(v) - lo) / span) * innerH;

/** Vertical space reserved below a log plot for values at or below zero. */
export const DEBT_STRIP_HEIGHT = 16;

export interface PlotY {
  /** Height of the linear debt strip; 0 when negatives render natively. */
  stripH: number;
  /** Top edge of the strip — the $0 boundary against the log region. */
  stripTop: number;
  y: (v: number) => number;
}

/**
 * A log axis cannot represent debt: clamping negatives onto the floor would
 * draw "net in debt" as "worth almost nothing". When the axis is
 * logarithmic and any value dips below zero, reserve a short linear strip
 * beneath the plot and land those values there; on a linear axis they
 * already render natively, so no strip is needed.
 */
export const makePlotY = (yScale: YScale, minV: number, pt: number, innerH: number): PlotY => {
  const stripH = yScale.log && minV < 0 ? DEBT_STRIP_HEIGHT : 0;
  const stripTop = pt + innerH - stripH;
  const yLog = makeY(yScale, pt, innerH - stripH);
  const y = (v: number) => (stripH > 0 && v <= 0 ? stripTop + stripH * (v / minV) : yLog(v));
  return { stripH, stripTop, y };
};

export const makeX =
  (minYear: number, maxYear: number, pl: number, innerW: number) => (year: number) =>
    pl + ((year - minYear) / Math.max(1, maxYear - minYear)) * innerW;

export function niceTicks(lo: number, hi: number, count: number): number[] {
  const span = hi - lo;
  if (span <= 0) return [lo];
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
  const ticks: number[] = [];
  const first = Math.ceil(lo / step) * step;
  for (let v = first; v <= hi + step * 0.001; v += step) {
    ticks.push(v);
  }
  return ticks;
}
