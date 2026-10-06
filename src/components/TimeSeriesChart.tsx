import {
  memo,
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { YearStats } from "../lib/sim";
import { formatMoney } from "../lib/format";
import { PALETTE } from "../lib/palette";
import { CHART_LAYOUT, makeX, makeY, makeYScale, niceTicks } from "../lib/chart";
import { useMeasuredWidth } from "../hooks/use-measured-width";

export interface TimeSeriesProps {
  stats: YearStats[];
  logScale: boolean;
  selectedYear: number;
  hoverYear: number | null;
  onHoverYear: (year: number | null) => void;
  onSelectYear?: (year: number) => void;
  dark?: boolean;
}

export const SERIES = [
  { key: "top1Avg" as const, label: "Top 1% avg", color: PALETTE.vermillion },
  { key: "mean" as const, label: "Mean", color: PALETTE.blue, dash: "7 4" },
  { key: "median" as const, label: "Median", color: PALETTE.slate, dash: "2 4" },
  {
    key: "bottom50Avg" as const,
    label: "Bottom 50% avg",
    color: PALETTE.green,
    dash: "10 3 2 3",
  },
];

export const TimeSeriesChart = memo(function TimeSeriesChart({
  stats,
  logScale,
  selectedYear,
  hoverYear,
  onHoverYear,
  onSelectYear,
  dark = false,
}: TimeSeriesProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const keyboardYearRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const [containerRef, W] = useMeasuredWidth();
  const {
    height: H,
    paddingLeft: PL,
    paddingRight: PR,
    paddingTop: PT,
    paddingBottom: PB,
  } = CHART_LAYOUT;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const narrow = W < 520;
  const gridColor = dark ? "#334155" : "#e2e8f0";
  const minorGridColor = dark ? "#263449" : "#f1f5f9";
  const tickColor = "#94a3b8";
  const activeLineColor = dark ? "#e2e8f0" : "#0f172a";
  const markerFill = dark ? "#0f172a" : "#ffffff";
  const badgeFill = dark ? "#e2e8f0" : "#0f172a";
  const badgeText = dark ? "#0f172a" : "#ffffff";

  const series = SERIES;

  const { paths, yTicks, xTicks, minYear, maxYear, yScale } = useMemo(() => {
    if (stats.length === 0) {
      return {
        paths: [] as string[],
        yTicks: [] as number[],
        xTicks: [] as number[],
        minYear: 0,
        maxYear: 0,
        yScale: makeYScale(0, 1, logScale),
      };
    }
    let minV = Infinity;
    let maxV = -Infinity;
    for (const s of stats) {
      for (const { key } of series) {
        minV = Math.min(minV, s[key]);
        maxV = Math.max(maxV, s[key]);
      }
    }

    const yScale = makeYScale(minV, maxV, logScale);
    const y = makeY(yScale, PT, innerH);

    const len = stats.length;
    const minYear = stats[0].year;
    const maxYear = stats[len - 1].year;
    const x = makeX(minYear, maxYear, PL, innerW);

    const paths = series.map(({ key }) => {
      const pts = stats.map((s) => `${x(s.year).toFixed(1)},${y(s[key]).toFixed(1)}`);
      return `M ${pts.join(" L ")}`;
    });

    const lo = yScale.lo;
    const hi = yScale.hi;
    const yTicks = yScale.log
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
      : niceTicks(minV, maxV, narrow ? 4 : 5);

    const xTicks = niceTicks(minYear, maxYear, narrow ? 4 : 6);

    return { paths, yTicks, xTicks, minYear, maxYear, yScale };
  }, [stats, logScale, narrow, W]);

  const activeYear = Math.max(minYear, Math.min(maxYear, hoverYear ?? selectedYear));

  // Declared before the empty-state early return below: every render must call
  // the same hooks in the same order, and this effect is unconditional.
  useEffect(() => {
    if (keyboardYearRef.current === activeYear) {
      keyboardYearRef.current = null;
    }
  }, [activeYear]);

  if (stats.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex h-full min-h-[320px] items-center justify-center text-sm text-slate-400"
      >
        No years to chart yet.
      </div>
    );
  }

  const y = makeY(yScale, PT, innerH);
  const x = makeX(minYear, maxYear, PL, innerW);

  const activeX = x(activeYear);

  const yearAtClientX = (clientX: number): number => {
    const svg = svgRef.current;
    if (!svg) return activeYear;
    const rect = svg.getBoundingClientRect();
    const xPx = ((clientX - rect.left) / rect.width) * W;
    const yearAt = Math.round(minYear + ((xPx - PL) / innerW) * (maxYear - minYear));
    return Math.max(minYear, Math.min(maxYear, yearAt));
  };

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    draggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic/inactive pointers cannot be captured; dragging still works.
    }
    const year = yearAtClientX(e.clientX);
    if (onSelectYear) onSelectYear(year);
    else onHoverYear(year);
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (draggingRef.current) {
      const year = yearAtClientX(e.clientX);
      if (onSelectYear) onSelectYear(year);
      else onHoverYear(year);
      return;
    }
    if (e.pointerType === "mouse") {
      onHoverYear(yearAtClientX(e.clientX));
    }
  };

  const endDrag = () => {
    draggingRef.current = false;
  };

  const handleKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!onSelectYear) return;
    const step = e.shiftKey ? 10 : 1;
    let next: number | null = null;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        next = (keyboardYearRef.current ?? activeYear) - step;
        break;
      case "ArrowRight":
      case "ArrowUp":
        next = (keyboardYearRef.current ?? activeYear) + step;
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
    keyboardYearRef.current = Math.max(minYear, Math.min(maxYear, next));
    onSelectYear(keyboardYearRef.current);
  };

  const clearKeyboardYear = () => {
    onHoverYear(null);
    keyboardYearRef.current = null;
  };

  const labelX = Math.min(W - PR - 56, Math.max(PL, activeX - 28));
  // A single-year series has maxYear 0, which would divide by zero and emit an
  // invalid `width="NaN"` on the progress bar.
  const progress = maxYear > 0 ? Math.min(1, Math.max(0, selectedYear / maxYear)) : 0;

  return (
    <div ref={containerRef} className="w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair touch-pan-y select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        role={onSelectYear ? "slider" : "img"}
        aria-label="Wealth over time. Use left and right arrow keys to change year, hold Shift to jump 10 years."
        aria-valuemin={onSelectYear ? minYear : undefined}
        aria-valuemax={onSelectYear ? maxYear : undefined}
        aria-valuenow={onSelectYear ? activeYear : undefined}
        aria-valuetext={onSelectYear ? `Year ${activeYear}` : undefined}
        tabIndex={onSelectYear ? 0 : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onMouseLeave={clearKeyboardYear}
        onKeyDown={handleKeyDown}
        onBlur={clearKeyboardYear}
      >
        {yTicks.map((v) => {
          const ty = y(v);
          return (
            <g key={v}>
              <line x1={PL} y1={ty} x2={W - PR} y2={ty} stroke={gridColor} strokeWidth={1} />
              <text x={PL - 8} y={ty + 3.5} textAnchor="end" fontSize={11} fill={tickColor}>
                {formatMoney(v)}
              </text>
            </g>
          );
        })}
        {xTicks.map((v) => {
          const tx = x(v);
          return (
            <g key={v}>
              <line x1={tx} y1={PT} x2={tx} y2={H - PB} stroke={minorGridColor} strokeWidth={1} />
              <text x={tx} y={H - PB + 16} textAnchor="middle" fontSize={11} fill={tickColor}>
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
              strokeWidth={s.key === "top1Avg" ? 2.2 : 1.8}
              strokeDasharray={s.dash}
              strokeLinejoin="round"
            />
          );
        })}
        <line
          x1={activeX}
          y1={PT}
          x2={activeX}
          y2={H - PB}
          stroke={activeLineColor}
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
              fill={markerFill}
              stroke={s.color}
              strokeWidth={2}
            />
          );
        })}
        <rect x={labelX} y={PT} width={56} height={20} rx={5} fill={badgeFill} />
        <text
          x={labelX + 28}
          y={PT + 14}
          textAnchor="middle"
          fontSize={11}
          fontWeight={700}
          fill={badgeText}
        >
          {activeYear}
        </text>
        <rect
          x={PL}
          y={H - 6}
          width={innerW}
          height={4}
          rx={2}
          fill={dark ? "#334155" : "#e2e8f0"}
          opacity={0.7}
        />
        {(() => {
          const lastRec = stats[stats.length - 1];
          const entries = series
            .map((s) => ({ key: s.key, label: s.label, color: s.color, y: y(lastRec[s.key]) }))
            .sort((a, b) => a.y - b.y);
          let prev = -Infinity;
          for (const entry of entries) {
            entry.y = Math.max(entry.y, prev + 13);
            prev = entry.y;
          }
          return entries.map((entry) => (
            <text
              key={entry.key}
              x={W - PR - 2}
              y={Math.min(PT + innerH - 4, Math.max(PT + 10, entry.y + 3.5))}
              textAnchor="end"
              fontSize={10}
              fontWeight={600}
              fill={entry.color}
              paintOrder="stroke"
              stroke={markerFill}
              strokeWidth={3}
              strokeLinejoin="round"
            >
              {entry.label}
            </text>
          ));
        })()}

        <rect
          x={PL}
          y={H - 6}
          width={Math.max(0, innerW * progress)}
          height={4}
          rx={2}
          fill={PALETTE.sky}
        />
      </svg>
    </div>
  );
});
