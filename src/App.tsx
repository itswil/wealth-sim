import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controls } from "./components/Controls";
import { Card } from "./components/Card";
import { TimeSeriesChart, SERIES } from "./components/TimeSeriesChart";
import { WealthDistribution } from "./components/WealthDistribution";
import {
  DEFAULT_PARAMS,
  MAX_YEAR,
  PRESETS,
  simulate,
  type SimulationSnapshot,
  type WorldParams,
} from "./lib/sim";
import {
  formatMoney,
  formatMultiple,
  formatMultiplier,
  formatNumber,
  formatPercent,
} from "./lib/format";
import { DEFAULT_SEED, readWorldFromUrl, serializeWorldToSearch } from "./lib/url-state";
import { useTheme } from "./hooks/use-theme";
import { useHasOverflow } from "./hooks/use-has-overflow";

const YEAR_PRESETS = [0, 25, 50, 100, 200, MAX_YEAR];
const EMPTY_SORTED = new Float64Array(0);
/** Long enough to collapse playback ticks, short enough to feel instant. */
const URL_SYNC_DEBOUNCE_MS = 500;

interface StatItem {
  label: string;
  value: string;
  sub?: string;
}

/** One completed run, paired with the inputs that produced it. */
type SimResult = {
  params: WorldParams;
  seed: number;
  snapshots: SimulationSnapshot[];
};

function StatCard({ item }: { item: StatItem }) {
  return (
    <div className="h-full rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase whitespace-nowrap dark:text-slate-400">
        {item.label}
      </p>
      <p className="mt-0.5 text-lg font-bold text-slate-800 tabular-nums whitespace-nowrap dark:text-slate-100">
        {item.value}
      </p>
      {item.sub ? (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.sub}</p>
      ) : null}
    </div>
  );
}

function App() {
  const [isDark, toggleTheme] = useTheme();
  const initialWorld = useMemo(readWorldFromUrl, []);
  const [params, setParams] = useState<WorldParams>(() => ({
    ...DEFAULT_PARAMS,
    ...initialWorld?.params,
  }));
  const [seed, setSeed] = useState(() => initialWorld?.seed ?? DEFAULT_SEED);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedYear, setSelectedYear] = useState(() => initialWorld?.year ?? 0);
  // Linear hides three of the four series behind the top-1% hockey stick, so
  // the log axis is the useful default; the toggle stays for direct comparison.
  const [logScale, setLogScale] = useState(true);
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  // The simulation runs once, after paint, in the debounce effect below — the
  // first render shows a loading state instead of blocking on the full run.
  const [result, setResult] = useState<SimResult | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setResult({ params, seed, snapshots: simulate(params, seed) });
    }, 50);
    return () => clearTimeout(t);
  }, [params, seed]);

  const snapshots = result?.snapshots ?? null;
  /**
   * The controls have moved on but the figures below still describe the last
   * completed run. Derived rather than set in the effect so it flips on the
   * same frame as the parameter change, not 50ms later.
   */
  const isStale = result !== null && (result.params !== params || result.seed !== seed);

  // On lg the controls panel is capped at viewport height and scrolls inside
  // itself; this only reports whether content really is clipped, so the fade
  // never sits over a panel that already fits.
  const controlsRef = useRef<HTMLElement>(null);
  const controlsHaveOverflow = useHasOverflow(controlsRef);

  useEffect(() => {
    if (!isPlaying) return;
    if (selectedYear >= MAX_YEAR) {
      setIsPlaying(false);
      return;
    }
    const t = setTimeout(() => setSelectedYear((y) => Math.min(MAX_YEAR, y + 1)), 30);
    return () => clearTimeout(t);
  }, [isPlaying, selectedYear]);

  useEffect(() => {
    // Debounced: WebKit throws SecurityError past ~100 replaceState calls per
    // 10-30s, and playback changes the year every 30ms. Debouncing means the
    // URL is written once the year settles (i.e. when playback pauses) instead
    // of 33 times a second.
    const t = setTimeout(() => {
      const search = serializeWorldToSearch(params, seed, selectedYear);
      window.history.replaceState(null, "", search);
    }, URL_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [params, seed, selectedYear]);

  const activeYear = Math.min(MAX_YEAR, hoverYear ?? selectedYear);
  const snap = snapshots ? snapshots[activeYear] : null;
  const stats = snap?.stats;
  const yearStats = useMemo(() => snapshots?.map((s) => s.stats) ?? [], [snapshots]);
  const sorted = snap ? snap.sorted : EMPTY_SORTED;

  const handlePatch = useCallback(
    (patch: Partial<WorldParams>) => setParams((p) => ({ ...p, ...patch })),
    [],
  );

  // Tolerant comparison: a shared link can carry a value off the slider step,
  // and exact float equality then dropped the highlight and the blurb.
  const activePreset = PRESETS.find(
    (p) =>
      Math.abs(p.incomeInequality - params.incomeInequality) < 1e-9 &&
      Math.abs(p.initialInequality - params.initialInequality) < 1e-9,
  );

  const handlePreset = useCallback((id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setParams((p) => ({
      ...p,
      incomeInequality: preset.incomeInequality,
      initialInequality: preset.initialInequality,
    }));
  }, []);

  const handleNewWorld = useCallback(() => {
    setSeed(Math.floor(Math.random() * 1e9));
    setSelectedYear(0);
    setHoverYear(null);
    setIsPlaying(false);
  }, []);

  const handleReset = useCallback(() => {
    setParams(DEFAULT_PARAMS);
    setSeed(DEFAULT_SEED);
    setSelectedYear(0);
    setHoverYear(null);
    setIsPlaying(false);
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    setHoverYear(null);
    setSelectedYear((y) => (y >= MAX_YEAR ? 0 : y));
    setIsPlaying(true);
  }, [isPlaying]);

  const handleSelectYear = useCallback((year: number) => {
    setSelectedYear(year);
    setHoverYear(null);
  }, []);

  const seriesLegend = SERIES.map(({ label, color }) => ({ label, color }));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      {/* The controls panel is ~30 tab stops long, so keyboard users need a
          route straight past it to the results. */}
      <a
        href="#results"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-10 focus:rounded-lg focus:bg-sky-700 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to results
      </a>
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
              Wealth Simulator
            </h1>
            <p className="hidden text-sm text-slate-500 sm:block dark:text-slate-400">
              A fixed 300-year run. Hover the timeline or pick a year to inspect that year's wealth.
            </p>
          </div>
          {/* Full width on mobile so the year scrubber stays easy to grab;
              shrink-to-fit from sm up, where `justify-between` parks it on the
              right of the title instead of stranding it on its own row. */}
          <div className="flex w-full items-center gap-2 sm:w-auto sm:ml-auto">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="flex h-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 px-2 text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {isDark ? (
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <circle cx="10" cy="10" r="4" />
                  <path
                    d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6L16 16M16 4l-1.4 1.4M5.4 14.6L4 16"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M17 12.5A7.5 7.5 0 0 1 7.5 3a7.5 7.5 0 1 0 9.5 9.5Z" />
                </svg>
              )}
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:w-auto sm:flex-none">
              <span className="text-xs font-bold tracking-widest text-slate-500 uppercase dark:text-slate-400">
                Year
              </span>
              <input
                type="range"
                min={0}
                max={MAX_YEAR}
                step={1}
                value={activeYear}
                onChange={(e) => {
                  setSelectedYear(Number(e.target.value));
                  setHoverYear(null);
                }}
                className="h-6 w-full min-w-0 accent-sky-600 sm:w-48"
                aria-label="Selected year"
              />
              <span className="w-10 shrink-0 text-right text-sm font-bold text-slate-800 tabular-nums dark:text-slate-100">
                {activeYear}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[340px_1fr]">
        {/* The expanded panel measures ~1765px — taller than any viewport — so
            `sticky` on its own never engaged and the Risk section scrolled off
            screen. Capping the height makes the sidebar a scrollable rail that
            stays pinned while the charts move. `overscroll-behavior` is left
            alone deliberately so that reaching the end of the rail hands the
            scroll straight back to the page instead of trapping it. */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="relative">
            <aside ref={controlsRef} className="lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
              <Controls
                params={params}
                presetId={activePreset?.id ?? ""}
                onChange={handlePatch}
                onPreset={handlePreset}
                onNewWorld={handleNewWorld}
                onReset={handleReset}
              />
            </aside>
            {/* Signals that the rail continues. Drawn only while the panel is
                genuinely clipped, and inset by the card's border so the edge
                stays crisp. */}
            {controlsHaveOverflow ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-px bottom-0 hidden h-12 bg-gradient-to-t from-white to-transparent dark:from-slate-800 lg:block"
              />
            ) : null}
          </div>
        </div>

        <section id="results" className="min-w-0 space-y-4" aria-label="Simulation results">
          {stats && snap ? (
            // Dimmed while a recompute is in flight so the figures never read
            // as settled when they describe the run before the last edit.
            <div
              aria-busy={isStale}
              className={`space-y-4 transition-opacity duration-150 motion-reduce:transition-none ${
                isStale ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase dark:text-slate-400">
                    Year
                  </span>
                  <span className="text-xl font-extrabold text-slate-900 tabular-nums dark:text-slate-50">
                    {formatNumber(stats.year)}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {isStale ? "recalculating…" : hoverYear !== null ? "hovering" : "selected"}
                  </span>
                </div>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase dark:text-slate-400">
                    Population
                  </span>
                  <span className="text-xl font-extrabold text-slate-900 tabular-nums dark:text-slate-50">
                    {formatNumber(snap.population)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 auto-rows-fr sm:grid-cols-3 xl:grid-cols-4">
                <StatCard
                  item={{
                    label: "Total wealth",
                    value: formatMoney(stats.total),
                    sub:
                      stats.total > 0
                        ? undefined
                        : "population is net in debt — shares are undefined",
                  }}
                />
                <StatCard item={{ label: "Mean wealth", value: formatMoney(stats.mean) }} />
                <StatCard item={{ label: "Median wealth", value: formatMoney(stats.median) }} />
                <StatCard
                  item={{
                    label: "Wealth ÷ income",
                    value: formatMultiple(stats.mean / stats.meanIncome),
                    sub: "mean net worth in years of income",
                  }}
                />
                <StatCard
                  item={{
                    label: "Gini",
                    value: stats.gini.toFixed(2),
                    sub: "0 = equal, 1 = one person owns all",
                  }}
                />
                <StatCard
                  item={{
                    label: "Top 1% share",
                    value: formatPercent(stats.top1Share),
                    sub:
                      stats.median > 0
                        ? `${formatMultiplier(stats.top1Avg / stats.median)} median wealth`
                        : undefined,
                  }}
                />
                <StatCard
                  item={{
                    label: "Bottom 50% share",
                    value: formatPercent(stats.bottom50Share),
                    sub:
                      stats.median > 0 ? `owns ${formatMoney(stats.bottom50Avg)} avg` : undefined,
                  }}
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <Card title="Wealth over time">
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    {seriesLegend.map((l) => (
                      <span
                        key={l.label}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: l.color }}
                        />
                        {l.label}
                      </span>
                    ))}
                    <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
                      <button
                        type="button"
                        onClick={handleTogglePlay}
                        aria-label={isPlaying ? "Pause animation" : "Play animation"}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-700 text-white transition-colors motion-reduce:transition-none hover:bg-sky-800"
                      >
                        {isPlaying ? (
                          <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden="true">
                            <rect
                              x="1.5"
                              y="1"
                              width="3"
                              height="10"
                              rx="0.5"
                              fill="currentColor"
                            />
                            <rect
                              x="7.5"
                              y="1"
                              width="3"
                              height="10"
                              rx="0.5"
                              fill="currentColor"
                            />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden="true">
                            <path d="M2.5 1.2 L10.5 6 L2.5 10.8 Z" fill="currentColor" />
                          </svg>
                        )}
                      </button>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Jump to:</span>
                      {YEAR_PRESETS.map((y) => (
                        <button
                          key={y}
                          type="button"
                          onClick={() => {
                            setSelectedYear(y);
                            setHoverYear(null);
                          }}
                          className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors motion-reduce:transition-none ${
                            activeYear === y
                              ? "bg-sky-700 text-white"
                              : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                          }`}
                        >
                          {y}
                        </button>
                      ))}
                      <label className="ml-1 flex cursor-pointer select-none items-center gap-2">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Log scale
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={logScale}
                          onClick={() => setLogScale((v) => !v)}
                          className={`relative h-6 w-11 rounded-full transition-colors motion-reduce:transition-none ${
                            logScale ? "bg-sky-600" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
                              logScale ? "translate-x-5" : ""
                            }`}
                          />
                        </button>
                      </label>
                    </div>
                  </div>
                  <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2 dark:border-slate-700">
                    {SERIES.map((s) => (
                      <span
                        key={s.key}
                        className="flex items-center gap-1.5 text-xs font-semibold tabular-nums"
                        style={{ color: s.text[isDark ? "dark" : "light"] }}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {formatMoney(stats[s.key])}
                      </span>
                    ))}
                  </div>
                  <TimeSeriesChart
                    stats={yearStats}
                    logScale={logScale}
                    selectedYear={selectedYear}
                    hoverYear={hoverYear}
                    onHoverYear={setHoverYear}
                    onSelectYear={handleSelectYear}
                    dark={isDark}
                  />
                </Card>
              </div>

              <Card
                title="Wealth distribution"
                sub={
                  hoverYear !== null
                    ? `Year ${hoverYear} · red = top 1%`
                    : `Year ${activeYear} · red = top 1%`
                }
              >
                <WealthDistribution
                  sorted={sorted}
                  mean={stats.mean}
                  median={stats.median}
                  dark={isDark}
                />
              </Card>
            </div>
          ) : (
            <div
              role="status"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Running the 300-year simulation…
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
