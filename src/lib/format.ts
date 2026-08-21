function trimZero(s: string): string {
  return s.replace(/\.?0+$/, "");
}

export function formatMoney(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const neg = v < 0;
  const a = Math.abs(v);
  let out: string;
  if (a >= 9.995e11) out = `${trimZero((a / 1e12).toFixed(2))}T`;
  else if (a >= 9.995e8) out = `${trimZero((a / 1e9).toFixed(2))}B`;
  else if (a >= 9.995e5) out = `${trimZero((a / 1e6).toFixed(2))}M`;
  else if (a >= 999.5) out = `${trimZero((a / 1e3).toFixed(1))}K`;
  else out = `${Math.round(a)}`;
  return `${neg ? "-" : ""}$${out}`;
}

export function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatPercent(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

export function formatMultiplier(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v < 10) return `${v.toFixed(1)}×`;
  return `${Math.round(v)}×`;
}
