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
  transform: (v: number) => number;
}

export function makeYScale(minV: number, maxV: number, logScale: boolean): YScale {
  const floor = Math.max(maxV * 1e-4, 1);
  const lo = logScale ? Math.log10(floor) : minV;
  const hi = logScale ? Math.log10(Math.max(maxV, floor)) : maxV;
  return {
    lo,
    hi,
    span: hi - lo || 1,
    transform: (v) => (logScale ? Math.log10(Math.max(v, floor)) : v),
  };
}

export const makeY =
  ({ lo, span, transform }: YScale, pt: number, innerH: number) =>
  (v: number) =>
    pt + (1 - (transform(v) - lo) / span) * innerH;

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
