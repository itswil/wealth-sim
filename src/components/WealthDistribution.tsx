import { memo, useId, useMemo, useRef, useState } from "react";
import { buildHistogram, percentile, top1Bins } from "../lib/sim";
import { formatMoney } from "../lib/format";
import { PALETTE, labelColor } from "../lib/palette";
import { CHART_LAYOUT } from "../lib/chart";
import { useMeasuredWidth } from "../hooks/use-measured-width";

export interface DistributionProps {
  sorted: Float64Array;
  mean: number;
  median: number;
  dark?: boolean;
}

export const WealthDistribution = memo(function WealthDistribution({
  sorted,
  mean,
  median,
  dark = false,
}: DistributionProps) {
  const [containerRef, W] = useMeasuredWidth();
  const highlightColor = dark ? "#f8fafc" : "#0f172a";
  const haloColor = dark ? "#0f172a" : "#ffffff";
  const minorGridColor = dark ? "#263449" : "#f1f5f9";
  // Slate-400 only clears AA against the dark card; on white it lands at 2.6:1.
  const tickColor = dark ? "#94a3b8" : "#64748b";
  const { height: H, paddingLeft: PL, paddingRight: PR, paddingTop: PT } = CHART_LAYOUT;
  // This chart prints "N people" / "N in debt" on the baseline the x-axis
  // ticks use, so it needs more room underneath than the time-series chart:
  // without it the last tick label and the count overlapped by ~28px.
  const PB = CHART_LAYOUT.paddingBottom + 20;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;

  const [hoverBin, setHoverBin] = useState<number | null>(null);
  const histRef = useRef<SVGSVGElement | null>(null);
  const summaryId = useId();

  // Bin count follows the measured width: 120 bins over a 300px mobile chart
  // is 2.5px bars, too thin to read or to hit.
  const binCount = Math.max(30, Math.min(120, Math.floor(innerW / 6)));
  const { bins, negatives } = useMemo(() => buildHistogram(sorted, binCount), [sorted, binCount]);
  const p99 = useMemo(() => percentile(sorted, 0.99), [sorted]);
  const n = sorted.length;
  const topFlags = useMemo(() => top1Bins(bins, n), [bins, n]);
  if (bins.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex h-full min-h-[320px] items-center justify-center text-sm text-slate-500 dark:text-slate-400"
      >
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

  const updateHoverBin = (clientX: number) => {
    const svg = histRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xPx = ((clientX - rect.left) / rect.width) * W;
    if (xPx < PL || xPx > W - PR) {
      setHoverBin(null);
      return;
    }
    const idx = Math.floor(((xPx - PL) / innerW) * bins.length);
    setHoverBin(Math.max(0, Math.min(bins.length - 1, idx)));
  };

  return (
    <div ref={containerRef} className="w-full">
      {/* The bar chart is pointer-driven, so the same information is offered as
          text for screen readers rather than being locked inside a tooltip. */}
      <p id={summaryId} className="sr-only">
        Wealth distribution for {n.toLocaleString()} people
        {negatives > 0 ? `, ${negatives.toLocaleString()} of them in debt` : ""}. Bars show how many
        people fall in each wealth range on a logarithmic scale; the richest 1% are highlighted.
      </p>
      <svg
        ref={histRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair touch-pan-y select-none"
        role="img"
        aria-label="Wealth distribution"
        aria-describedby={summaryId}
        onPointerDown={(e) => updateHoverBin(e.clientX)}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse") updateHoverBin(e.clientX);
        }}
        onPointerLeave={() => setHoverBin(null)}
      >
        {logTicks.map((v) => {
          const tx = logX(v);
          return (
            <g key={v}>
              <line x1={tx} y1={PT} x2={tx} y2={H - PB} stroke={minorGridColor} strokeWidth={1} />
              <text x={tx} y={H - PB + 16} textAnchor="middle" fontSize={11} fill={tickColor}>
                {formatMoney(v)}
              </text>
            </g>
          );
        })}
        {bins.map((b, i) => {
          const top = PT + innerH * (1 - b.count / maxCount);
          const isTop1 = topFlags[i];
          return (
            <rect
              key={i}
              x={barX(i) + 0.5}
              y={top}
              width={Math.max(0.5, binW - 1)}
              height={PT + innerH - top}
              fill={isTop1 ? PALETTE.vermillion : PALETTE.blue}
              opacity={hoverBin === i ? 1 : isTop1 ? 0.85 : 0.75}
            />
          );
        })}
        {hoverBin !== null && bins[hoverBin]
          ? (() => {
              const hb = bins[hoverBin];
              const boxW = 150;
              const boxH = 36;
              const tx = Math.min(
                W - PR - boxW - 2,
                Math.max(PL + 2, barX(hoverBin) + binW / 2 - boxW / 2),
              );
              return (
                <g>
                  <rect
                    x={barX(hoverBin)}
                    y={PT}
                    width={binW}
                    height={innerH}
                    fill={highlightColor}
                    opacity={0.08}
                  />
                  <rect
                    x={tx}
                    y={PT + 2}
                    width={boxW}
                    height={boxH}
                    rx={5}
                    fill="#0f172a"
                    opacity={0.92}
                  />
                  <text x={tx + 8} y={PT + 16} fontSize={10.5} fontWeight={600} fill="#ffffff">
                    {formatMoney(hb.min)} – {formatMoney(hb.max)}
                  </text>
                  <text x={tx + 8} y={PT + 30} fontSize={10.5} fill="#cbd5e1">
                    {hb.count.toLocaleString()} people
                  </text>
                </g>
              );
            })()
          : null}
        {p99 > 0 ? (
          <line
            x1={logX(p99)}
            y1={PT}
            x2={logX(p99)}
            y2={H - PB}
            stroke={PALETTE.vermillion}
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
            fill={labelColor("vermillion", dark)}
            fontWeight={600}
            paintOrder="stroke"
            stroke={haloColor}
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
            stroke={PALETTE.blue}
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
            stroke={PALETTE.slate}
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
            fill={labelColor("blue", dark)}
            fontWeight={600}
            paintOrder="stroke"
            stroke={haloColor}
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
            fill={labelColor("slate", dark)}
            fontWeight={600}
            paintOrder="stroke"
            stroke={haloColor}
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
            fill={PALETTE.vermillion}
            paintOrder="stroke"
            stroke={haloColor}
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
          fill={tickColor}
          textAnchor="end"
          paintOrder="stroke"
          stroke={haloColor}
          strokeWidth={3}
          strokeLinejoin="round"
        >
          {n.toLocaleString()} people
        </text>
      </svg>
    </div>
  );
});
