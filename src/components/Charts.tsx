import { memo, useMemo, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import type { YearStats } from "../lib/sim";
import { buildHistogram, percentile } from "../lib/sim";
import { formatMoney } from "../lib/format";

interface CardProps {
  title: string;
  children: ReactNode;
  className?: string;
  sub?: string;
}

function Card({ title, children, className = "", sub }: CardProps) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">{title}</h3>
        {sub ? <p className="text-xs text-slate-400">{sub}</p> : null}
      </div>
      {children}
    </div>
  );
}

function niceTicks(lo: number, hi: number, count: number): number[] {
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

export interface TimeSeriesProps {
  stats: YearStats[];
  logScale: boolean;
  selectedYear: number;
  hoverYear: number | null;
  onHoverYear: (year: number | null) => void;
  onSelectYear?: (year: number) => void;
}

export const SERIES = [
  { key: "top1Avg" as const, label: "Top 1% avg", color: "#e11d48" },
  { key: "mean" as const, label: "Mean", color: "#0284c7" },
  { key: "median" as const, label: "Median", color: "#64748b" },
  { key: "bottom50Avg" as const, label: "Bottom 50% avg", color: "#16a34a" },
];

export const TimeSeriesChart = memo(function TimeSeriesChart({
  stats,
  logScale,
  selectedYear,
  hoverYear,
  onHoverYear,
  onSelectYear,
}: TimeSeriesProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const W = 820;
  const H = 320;
  const PL = 74;
  const PR = 18;
  const PT = 14;
  const PB = 28;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;

  const series = SERIES;

  const { paths, yTicks, xTicks, minV, maxV, minYear, maxYear } = useMemo(() => {
    let minV = Infinity;
    let maxV = -Infinity;
    for (const s of stats) {
      for (const { key } of series) {
        minV = Math.min(minV, s[key]);
        maxV = Math.max(maxV, s[key]);
      }
    }

    const floor = Math.max(maxV * 1e-4, 1);
    const lo = logScale ? Math.log10(floor) : minV;
    const hi = logScale ? Math.log10(Math.max(maxV, floor)) : maxV;
    const span = hi - lo || 1;
    const transform = (v: number) => (logScale ? Math.log10(Math.max(v, floor)) : v);
    const y = (v: number) => PT + (1 - (transform(v) - lo) / span) * innerH;

    const len = stats.length;
    const minYear = stats[0].year;
    const maxYear = stats[len - 1].year;
    const x = (year: number) => PL + ((year - minYear) / Math.max(1, maxYear - minYear)) * innerW;

    const paths = series.map(({ key }) => {
      const pts = stats.map((s) => `${x(s.year).toFixed(1)},${y(s[key]).toFixed(1)}`);
      return `M ${pts.join(" L ")}`;
    });

    const yTicks = logScale
      ? (() => {
          const ticks: number[] = [];
          const loPow = Math.ceil(lo);
          const hiPow = Math.floor(hi);
          for (let p = loPow; p <= hiPow; p++) {
            ticks.push(Math.pow(10, p));
          }
          if (ticks.length === 0) ticks.push(Math.pow(10, Math.round((lo + hi) / 2)));
          return ticks;
        })()
      : niceTicks(minV, maxV, 5);

    const xTicks = niceTicks(minYear, maxYear, 6);

    return { paths, yTicks, xTicks, minV, maxV, minYear, maxYear };
  }, [stats, logScale]);

  const floor = Math.max(maxV * 1e-4, 1);
  const lo = logScale ? Math.log10(floor) : minV;
  const hi = logScale ? Math.log10(Math.max(maxV, floor)) : maxV;
  const span = hi - lo || 1;
  const transform = (v: number) => (logScale ? Math.log10(Math.max(v, floor)) : v);
  const y = (v: number) => PT + (1 - (transform(v) - lo) / span) * innerH;
  const x = (year: number) => PL + ((year - minYear) / Math.max(1, maxYear - minYear)) * innerW;

  const activeYear = Math.max(minYear, Math.min(maxYear, hoverYear ?? selectedYear));
  const activeX = x(activeYear);

  const handleMove = (e: MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xPx = ((e.clientX - rect.left) / rect.width) * W;
    const yearAt = Math.round(minYear + ((xPx - PL) / innerW) * (maxYear - minYear));
    onHoverYear(Math.max(minYear, Math.min(maxYear, yearAt)));
  };

  const handleKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!onSelectYear) return;
    const step = e.shiftKey ? 10 : 1;
    let next: number | null = null;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        next = activeYear - step;
        break;
      case "ArrowRight":
      case "ArrowUp":
        next = activeYear + step;
        break;
      case "Home":
        next = minYear;
        break;
      case "End":
        next = maxYear;
        break;
      default:
        return;
    }
    e.preventDefault();
    onSelectYear(Math.max(minYear, Math.min(maxYear, next)));
  };

  const labelX = Math.min(W - PR - 56, Math.max(PL, activeX - 28));

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full cursor-crosshair touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      role="img"
      aria-label="Wealth over time. Use left and right arrow keys to change year, hold Shift to jump 10 years."
      tabIndex={onSelectYear ? 0 : undefined}
      onMouseMove={handleMove}
      onMouseLeave={() => onHoverYear(null)}
      onKeyDown={handleKeyDown}
    >
      {yTicks.map((v) => {
        const ty = y(v);
        return (
          <g key={v}>
            <line x1={PL} y1={ty} x2={W - PR} y2={ty} stroke="#e2e8f0" strokeWidth={1} />
            <text x={PL - 8} y={ty + 3.5} textAnchor="end" fontSize={11} fill="#94a3b8">
              {formatMoney(v)}
            </text>
          </g>
        );
      })}
      {xTicks.map((v) => {
        const tx = x(v);
        return (
          <g key={v}>
            <line x1={tx} y1={PT} x2={tx} y2={H - PB} stroke="#f1f5f9" strokeWidth={1} />
            <text x={tx} y={H - PB + 16} textAnchor="middle" fontSize={11} fill="#94a3b8">
              {v}
            </text>
          </g>
        );
      })}
      {paths.map((d, idx) => {
        const s = series[idx];
        return (
          <path
            key={s.key}
            d={d}
            fill="none"
            stroke={s.color}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
        );
      })}
      <line
        x1={activeX}
        y1={PT}
        x2={activeX}
        y2={H - PB}
        stroke="#0f172a"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      {series.map((s) => {
        const rec = stats[activeYear - minYear];
        if (!rec) return null;
        return (
          <circle
            key={s.key}
            cx={activeX}
            cy={y(rec[s.key])}
            r={3.5}
            fill="#ffffff"
            stroke={s.color}
            strokeWidth={2}
          />
        );
      })}
      <rect x={labelX} y={PT} width={56} height={20} rx={5} fill="#0f172a" />
      <text
        x={labelX + 28}
        y={PT + 14}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill="#ffffff"
      >
        {activeYear}
      </text>
    </svg>
  );
});

export interface DistributionProps {
  sorted: Float64Array;
  mean: number;
  median: number;
}

export const WealthDistribution = memo(function WealthDistribution({
  sorted,
  mean,
  median,
}: DistributionProps) {
  const W = 820;
  const H = 320;
  const PL = 74;
  const PR = 18;
  const PT = 14;
  const PB = 28;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;

  const { bins, negatives } = useMemo(() => buildHistogram(sorted), [sorted]);
  const p99 = useMemo(() => percentile(sorted, 0.99), [sorted]);
  const n = sorted.length;
  if (bins.length === 0) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-slate-400">
        Everyone is in debt — no positive wealth to chart.
      </div>
    );
  }

  const maxCount = Math.max(1, ...bins.map((b) => b.count));
  const binW = innerW / bins.length;
  const minLog = Math.log10(bins[0].min);
  const maxLog = Math.log10(bins[bins.length - 1].max);
  const logSpan = maxLog - minLog || 1;

  const barX = (b: number) => PL + b * binW;
  const logX = (v: number) => PL + ((Math.log10(v) - minLog) / logSpan) * innerW;

  const logTicks = (() => {
    const lo = Math.ceil(minLog);
    const hi = Math.floor(maxLog);
    const ticks: number[] = [];
    for (let p = lo; p <= hi; p++) {
      const v = Math.pow(10, p);
      if (v >= bins[0].min && v <= bins[bins.length - 1].max) ticks.push(v);
    }
    return ticks;
  })();

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Wealth distribution">
      {logTicks.map((v) => {
        const tx = logX(v);
        return (
          <g key={v}>
            <line x1={tx} y1={PT} x2={tx} y2={H - PB} stroke="#f1f5f9" strokeWidth={1} />
            <text x={tx} y={H - PB + 16} textAnchor="middle" fontSize={11} fill="#94a3b8">
              {formatMoney(v)}
            </text>
          </g>
        );
      })}
      {bins.map((b, i) => {
        const top = PT + innerH * (1 - b.count / maxCount);
        const isTop1 = b.min >= p99;
        return (
          <rect
            key={i}
            x={barX(i) + 0.5}
            y={top}
            width={Math.max(0.5, binW - 1)}
            height={PT + innerH - top}
            fill={isTop1 ? "#e11d48" : "#0284c7"}
            opacity={isTop1 ? 0.85 : 0.75}
          />
        );
      })}
      {p99 > 0 ? (
        <line
          x1={logX(p99)}
          y1={PT}
          x2={logX(p99)}
          y2={H - PB}
          stroke="#e11d48"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      ) : null}
      {p99 > 0 ? (
        <text
          x={Math.min(W - PR, logX(p99) - 4)}
          y={PT + 12}
          textAnchor="end"
          fontSize={10}
          fill="#be123c"
          fontWeight={600}
          paintOrder="stroke"
          stroke="#ffffff"
          strokeWidth={3}
          strokeLinejoin="round"
        >
          top 1% →
        </text>
      ) : null}
      {mean > 0 ? (
        <line
          x1={logX(mean)}
          y1={PT}
          x2={logX(mean)}
          y2={H - PB}
          stroke="#0284c7"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      ) : null}
      {median > 0 ? (
        <line
          x1={logX(median)}
          y1={PT}
          x2={logX(median)}
          y2={H - PB}
          stroke="#64748b"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      ) : null}
      {mean > 0 ? (
        <text
          x={Math.max(PL, logX(mean) - 4)}
          y={PT + 12}
          textAnchor="end"
          fontSize={10}
          fill="#0284c7"
          fontWeight={600}
          paintOrder="stroke"
          stroke="#ffffff"
          strokeWidth={3}
          strokeLinejoin="round"
        >
          mean {formatMoney(mean)} →
        </text>
      ) : null}
      {median > 0 ? (
        <text
          x={Math.max(PL, logX(median) - 4)}
          y={PT + 26}
          textAnchor="end"
          fontSize={10}
          fill="#64748b"
          fontWeight={600}
          paintOrder="stroke"
          stroke="#ffffff"
          strokeWidth={3}
          strokeLinejoin="round"
        >
          median {formatMoney(median)} →
        </text>
      ) : null}
      {negatives > 0 ? (
        <text
          x={PL}
          y={H - 8}
          fontSize={11}
          fill="#e11d48"
          paintOrder="stroke"
          stroke="#ffffff"
          strokeWidth={3}
          strokeLinejoin="round"
        >
          {negatives.toLocaleString()} in debt
        </text>
      ) : null}
      <text
        x={PL + innerW}
        y={H - 8}
        fontSize={11}
        fill="#94a3b8"
        textAnchor="end"
        paintOrder="stroke"
        stroke="#ffffff"
        strokeWidth={3}
        strokeLinejoin="round"
      >
        {n.toLocaleString()} people
      </text>
    </svg>
  );
});

export { Card };
