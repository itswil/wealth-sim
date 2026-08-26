import { useCallback, useEffect, useMemo, useState } from "react";
import { Controls } from "./components/Controls";
import { Card, TimeSeriesChart, WealthDistribution, SERIES } from "./components/Charts";
import {
  DEFAULT_PARAMS,
  MAX_YEAR,
  PRESETS,
  simulate,
  sortWealth,
  type WorldParams,
} from "./lib/sim";
import { formatMoney, formatMultiplier, formatNumber, formatPercent } from "./lib/format";
import { DEFAULT_SEED, readWorldFromUrl, serializeWorldToSearch } from "./lib/url-state";
import { useTheme } from "./hooks/use-theme";

const YEAR_PRESETS = [0, 25, 50, 100, 200, MAX_YEAR];

interface StatItem {
  label: string;
  value: string;
  sub?: string;
}

function StatCard({ item }: { item: StatItem }) {
  return (
    <div className="h-full rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase whitespace-nowrap">
        {item.label}
      </p>
      <p className="mt-0.5 text-lg font-bold text-slate-800 tabular-nums whitespace-nowrap dark:text-slate-100">
        {item.value}
      </p>
      {item.sub ? <p className="mt-0.5 text-xs text-slate-400">{item.sub}</p> : null}
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
  const [logScale, setLogScale] = useState(false);
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const [snapshots, setSnapshots] = useState(() => simulate(params, seed));

  useEffect(() => {
    const t = setTimeout(() => {
      setSnapshots(simulate(params, seed));
    }, 50);
    return () => clearTimeout(t);
  }, [params, seed]);

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
    const search = serializeWorldToSearch(params, seed, selectedYear);
    window.history.replaceState(null, "", search);
  }, [params, seed, selectedYear]);

  const activeYear = Math.min(snapshots.length - 1, hoverYear ?? selectedYear);
  const snap = snapshots[activeYear];
  const stats = snap.stats;
  const yearStats = useMemo(() => snapshots.map((s) => s.stats), [snapshots]);
  // Sorting is cached per year so scrubbing back to a visited year is free and
  // downstream memos see a stable identity for the same snapshot.
  const getSortedWealth = useMemo(() => {
    const cache = new Map<number, Float64Array>();
    return (year: number) => {
      let s = cache.get(year);
      if (s === undefined) {
        s = sortWealth(snapshots[year].wealth);
        cache.set(year, s);
      }
      return s;
    };
  }, [snapshots]);
  const sorted = getSortedWealth(activeYear);

  const handlePatch = useCallback(
    (patch: Partial<WorldParams>) => setParams((p) => ({ ...p, ...patch })),
    [],
  );

  const activePreset = PRESETS.find(
    (p) =>
      p.incomeInequality === params.incomeInequality &&
      p.initialInequality === params.initialInequality,
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
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
              Wealth Simulator
            </h1>
            <p className="hidden text-sm text-slate-500 sm:block">
              A fixed 300-year run. Hover the timeline or pick a year to inspect that year's wealth.
            </p>
          </div>
          <div className="flex w-full items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="flex h-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
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
              <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">
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
                className="w-full min-w-0 accent-sky-600 sm:w-48"
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
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Controls
            params={params}
            presetId={activePreset?.id ?? ""}
            onChange={handlePatch}
            onPreset={handlePreset}
            onNewWorld={handleNewWorld}
            onReset={handleReset}
          />
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                Year
              </span>
              <span className="text-xl font-extrabold text-slate-900 tabular-nums dark:text-slate-50">
                {formatNumber(stats.year)}
              </span>
              <span className="text-xs text-slate-400">
                {hoverYear !== null ? "hovering" : "selected"}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                Population
              </span>
              <span className="text-xl font-extrabold text-slate-900 tabular-nums dark:text-slate-50">
                {formatNumber(snap.wealth.length)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 auto-rows-fr">
            <StatCard item={{ label: "Total wealth", value: formatMoney(stats.total) }} />
            <StatCard item={{ label: "Mean wealth", value: formatMoney(stats.mean) }} />
            <StatCard item={{ label: "Median wealth", value: formatMoney(stats.median) }} />
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
                sub: stats.median > 0 ? `owns ${formatMoney(stats.bottom50Avg)} avg` : undefined,
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
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                    {l.label}
                  </span>
                ))}
                <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    aria-label={isPlaying ? "Pause animation" : "Play animation"}
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-600 text-white transition-colors hover:bg-sky-700"
                  >
                    {isPlaying ? (
                      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                        <rect x="1.5" y="1" width="3" height="10" rx="0.5" fill="currentColor" />
                        <rect x="7.5" y="1" width="3" height="10" rx="0.5" fill="currentColor" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                        <path d="M2.5 1.2 L10.5 6 L2.5 10.8 Z" fill="currentColor" />
                      </svg>
                    )}
                  </button>
                  <span className="text-xs text-slate-400">Jump to:</span>
                  {YEAR_PRESETS.map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => {
                        setSelectedYear(y);
                        setHoverYear(null);
                      }}
                      className={`rounded-md px-1.5 py-0.5 text-xs font-semibold transition-colors ${
                        activeYear === y
                          ? "bg-sky-600 text-white"
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
                      className={`relative h-5 w-9 rounded-full transition-colors ${
                        logScale ? "bg-sky-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          logScale ? "translate-x-4" : ""
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
                    style={{ color: s.color }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
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
        </section>
      </main>
    </div>
  );
}

export default App;
