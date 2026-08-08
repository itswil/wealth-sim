import { useEffect, useState } from "react";
import { Controls } from "./components/Controls";
import { Card, TimeSeriesChart, WealthDistribution } from "./components/Charts";
import { DEFAULT_PARAMS, MAX_YEAR, PRESETS, simulate, type WorldParams } from "./lib/sim";
import { formatMoney, formatMultiplier, formatNumber, formatPercent } from "./lib/format";

const YEAR_PRESETS = [0, 25, 50, 100, 200, MAX_YEAR];

interface StatItem {
  label: string;
  value: string;
  sub?: string;
}

function StatCard({ items }: { items: StatItem[] }) {
  const item = items[0];
  return (
    <div className="h-full rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase whitespace-nowrap">
        {item.label}
      </p>
      <p className="mt-0.5 text-lg font-bold text-slate-800 tabular-nums whitespace-nowrap">
        {item.value}
      </p>
      {item.sub ? <p className="mt-0.5 text-xs text-slate-400">{item.sub}</p> : null}
    </div>
  );
}

function App() {
  const [params, setParams] = useState<WorldParams>(DEFAULT_PARAMS);
  const [presetId, setPresetId] = useState("moderate");
  const [seed, setSeed] = useState(42);
  const [logScale, setLogScale] = useState(false);
  const [selectedYear, setSelectedYear] = useState(0);
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const [snapshots, setSnapshots] = useState(() => simulate(DEFAULT_PARAMS, 42));

  useEffect(() => {
    const t = setTimeout(() => {
      setSnapshots(simulate(params, seed));
    }, 120);
    return () => clearTimeout(t);
  }, [params, seed]);

  const activeYear = Math.min(snapshots.length - 1, hoverYear ?? selectedYear);
  const snap = snapshots[activeYear];
  const stats = snap.stats;
  const sorted = snap.sorted;
  const yearStats = snapshots.map((s) => s.stats);

  const handlePatch = (patch: Partial<WorldParams>) => setParams((p) => ({ ...p, ...patch }));

  const handlePreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setParams((p) => ({
      ...p,
      incomeInequality: preset.incomeInequality,
      initialInequality: preset.initialInequality,
    }));
  };

  const handleNewWorld = () => {
    setSeed(Math.floor(Math.random() * 1e9));
    setSelectedYear(0);
    setHoverYear(null);
  };

  const handleReset = () => {
    setSelectedYear(0);
    setHoverYear(null);
  };

  const seriesLegend = [
    { label: "Top 1% avg", color: "#e11d48" },
    { label: "Mean", color: "#0284c7" },
    { label: "Median", color: "#64748b" },
    { label: "Bottom 50% avg", color: "#16a34a" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Wealth Simulator
            </h1>
            <p className="text-sm text-slate-500">
              A fixed 300-year run. Hover the timeline or pick a year to inspect that year's wealth.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">Year</span>
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
              className="w-48 accent-sky-600"
              aria-label="Selected year"
            />
            <span className="w-12 text-right text-sm font-bold text-slate-800 tabular-nums">
              {activeYear}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[340px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Controls
            params={params}
            presetId={presetId}
            onChange={handlePatch}
            onPreset={handlePreset}
            onNewWorld={handleNewWorld}
            onReset={handleReset}
          />
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                Year
              </span>
              <span className="text-xl font-extrabold text-slate-900 tabular-nums">
                {formatNumber(stats.year)}
              </span>
              <span className="text-xs text-slate-400">
                {hoverYear !== null ? "hovering" : "selected"}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                Population
              </span>
              <span className="text-xl font-extrabold text-slate-900 tabular-nums">
                {formatNumber(snapshots[0].sorted.length)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 auto-rows-fr">
            <StatCard items={[{ label: "Total wealth", value: formatMoney(stats.total) }]} />
            <StatCard items={[{ label: "Mean wealth", value: formatMoney(stats.mean) }]} />
            <StatCard items={[{ label: "Median wealth", value: formatMoney(stats.median) }]} />
            <StatCard
              items={[
                {
                  label: "Gini",
                  value: stats.gini.toFixed(2),
                  sub: "0 = equal, 1 = one person owns all",
                },
              ]}
            />
            <StatCard
              items={[
                {
                  label: "Top 1% share",
                  value: formatPercent(stats.top1Share),
                  sub:
                    stats.median > 0
                      ? `${formatMultiplier(stats.top1Avg / stats.median)} median wealth`
                      : undefined,
                },
              ]}
            />
            <StatCard
              items={[
                {
                  label: "Bottom 50% share",
                  value: formatPercent(stats.bottom50Share),
                  sub: stats.median > 0 ? `owns ${formatMoney(stats.bottom50Avg)} avg` : undefined,
                },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Card title="Wealth over time">
              <div className="mb-2 flex flex-wrap items-center gap-3">
                {seriesLegend.map((l) => (
                  <span
                    key={l.label}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-600"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                    {l.label}
                  </span>
                ))}
                <div className="ml-auto flex items-center gap-1.5">
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
                          : "border border-slate-300 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                  <label className="ml-1 flex cursor-pointer select-none items-center gap-2">
                    <span className="text-xs font-medium text-slate-600">Log scale</span>
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
              <TimeSeriesChart
                stats={yearStats}
                logScale={logScale}
                selectedYear={selectedYear}
                hoverYear={hoverYear}
                onHoverYear={setHoverYear}
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
            <WealthDistribution sorted={sorted} mean={stats.mean} median={stats.median} />
          </Card>
        </section>
      </main>
    </div>
  );
}

export default App;
