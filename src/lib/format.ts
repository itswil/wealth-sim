function trimZero(s: string): string {
  return s.replace(/\.?0+$/, "");
}

export function formatMoney(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const neg = v < 0;
  const a = Math.abs(v);
  let out: string;
  if (a >= 9.995e14) out = `${trimZero((a / 1e15).toFixed(2))}Q`;
  else if (a >= 9.995e11) out = `${trimZero((a / 1e12).toFixed(2))}T`;
  else if (a >= 9.995e8) out = `${trimZero((a / 1e9).toFixed(2))}B`;
  else if (a >= 9.995e5) out = `${trimZero((a / 1e6).toFixed(2))}M`;
  else if (a >= 999.5) out = `${trimZero((a / 1e3).toFixed(1))}K`;
  else out = `${Math.round(a)}`;
  return `${neg ? "-" : ""}$${out}`;
}

/**
 * A compact "how many times over" figure. Wealth grows orders of magnitude
 * faster than income over 300 years, so the wealth-to-income ratio needs
 * suffixes where a plain multiplier would print seven digits.
 */
export function formatMultiple(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const neg = v < 0;
  const a = Math.abs(v);
  let out: string;
  if (a >= 1e6) out = `${trimZero((a / 1e6).toFixed(1))}M`;
  else if (a >= 1e3) out = `${trimZero((a / 1e3).toFixed(1))}K`;
  else out = a < 10 ? a.toFixed(1) : `${Math.round(a)}`;
  return `${neg ? "-" : ""}${out}×`;
}

export function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatPercent(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function formatMultiplier(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v < 10) return `${v.toFixed(1)}×`;
  return `${Math.round(v)}×`;
}
