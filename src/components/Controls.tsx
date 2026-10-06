import { memo, useEffect, useId, useState, type ReactNode } from "react";
import { PARAM_RANGES, PRESETS, type WorldParams } from "../lib/sim";
import { formatMoney, formatPercent } from "../lib/format";
import { useMediaQuery } from "../hooks/use-media-query";

interface SliderProps {
  /** Which parameter this slider edits; bounds and step come from PARAM_RANGES. */
  param: keyof WorldParams;
  label: string;
  value: number;
  display: string;
  hint?: string;
  onChange: (patch: Partial<WorldParams>) => void;
}

function Slider({ param, label, value, display, hint, onChange }: SliderProps) {
  const hintId = useId();
  const { min, max, step } = PARAM_RANGES[param];
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300 tabular-nums">
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-describedby={hint ? hintId : undefined}
        onChange={(e) => onChange({ [param]: Number(e.target.value) } as Partial<WorldParams>)}
        className="mt-1 h-6 w-full accent-sky-600"
      />
      {hint ? (
        <p id={hintId} className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </label>
  );
}

interface SectionProps {
  title: string;
  /** Owned by the panel so one breakpoint means one listener, not one per section. */
  isWide: boolean;
  children: ReactNode;
}

function Section({ title, isWide, children }: SectionProps) {
  // Controlled so manual expand/collapse survives re-renders, while still
  // tracking the viewport breakpoint when it changes.
  const [open, setOpen] = useState(isWide);
  useEffect(() => setOpen(isWide), [isWide]);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group border-t border-slate-200 px-4 py-2 first:border-t-0 dark:border-slate-700"
    >
      {/* py-1.5 keeps the summary row >=24px tall so it meets the WCAG 2.2
          target-size minimum; padding lives here rather than on the section so
          the visual gap above the heading stays the same. */}
      <summary className="flex cursor-pointer select-none list-none items-center justify-between py-1.5 [&::-webkit-details-marker]:hidden">
        <h3 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase dark:text-slate-400">
          {title}
        </h3>
        <svg
          className="h-3.5 w-3.5 text-slate-500 transition-transform motion-reduce:transition-none group-open:rotate-180 dark:text-slate-400"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className="space-y-3 pt-3">{children}</div>
    </details>
  );
}

export interface ControlsProps {
  params: WorldParams;
  presetId: string;
  onChange: (patch: Partial<WorldParams>) => void;
  onPreset: (id: string) => void;
  onNewWorld: () => void;
  onReset: () => void;
}

export const Controls = memo(function Controls({
  params,
  presetId,
  onChange,
  onPreset,
  onNewWorld,
  onReset,
}: ControlsProps) {
  // One breakpoint, one listener: the panel is sticky and open at the lg
  // breakpoint and collapsible below it.
  const isWide = useMediaQuery("(min-width: 1024px)");
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:bg-slate-800">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
          Simulation controls
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onNewWorld}
            className="rounded-lg bg-sky-700 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors motion-reduce:transition-none hover:bg-sky-800"
          >
            New world
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors motion-reduce:transition-none hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Reset
          </button>
        </div>
      </div>

      <Section title="World" isWide={isWide}>
        <div className="space-y-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Any change re-runs the 300-year simulation and updates every chart.
          </p>
          <Slider
            param="populationSize"
            label="Population"
            value={params.populationSize}
            display={`${params.populationSize.toLocaleString()} people`}
            onChange={onChange}
          />
          <Slider
            param="initialWealth"
            label="Initial wealth (avg)"
            value={params.initialWealth}
            display={formatMoney(params.initialWealth)}
            hint="Baseline wealth handed to each person at year 0."
            onChange={onChange}
          />
        </div>
      </Section>

      <Section title="Inequality" isWide={isWide}>
        <div className="grid grid-cols-4 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPreset(p.id)}
              className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors motion-reduce:transition-none ${
                presetId === p.id
                  ? "bg-sky-700 text-white"
                  : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {PRESETS.find((p) => p.id === presetId)?.blurb ?? ""}
        </p>
        <Slider
          param="incomeInequality"
          label="Income inequality"
          value={params.incomeInequality}
          display={params.incomeInequality.toFixed(2)}
          hint="Spread of the income distribution (higher = wider)."
          onChange={onChange}
        />
        <Slider
          param="initialInequality"
          label="Initial wealth inequality"
          value={params.initialInequality}
          display={params.initialInequality.toFixed(2)}
          hint="How concentrated starting wealth is."
          onChange={onChange}
        />
      </Section>

      <Section title="Economy" isWide={isWide}>
        <Slider
          param="meanIncome"
          label="Mean income"
          value={params.meanIncome}
          display={formatMoney(params.meanIncome)}
          hint="Peak-earning average. Careers rise and fall with age."
          onChange={onChange}
        />
        <Slider
          param="returnRate"
          label="Investment return"
          value={params.returnRate}
          display={`${(params.returnRate * 100).toFixed(1)}% / yr`}
          hint="Returns compound on existing wealth — the rich get richer."
          onChange={onChange}
        />
        <Slider
          param="savingsRate"
          label="Savings rate"
          value={params.savingsRate}
          display={`${(params.savingsRate * 100).toFixed(1)}%`}
          hint="Share of income saved after living costs."
          onChange={onChange}
        />
        <Slider
          param="costOfLiving"
          label="Cost of living"
          value={params.costOfLiving}
          display={formatMoney(params.costOfLiving)}
          hint="Fixed yearly costs everyone must pay. Bites the poor hardest."
          onChange={onChange}
        />
        <Slider
          param="productivityGrowth"
          label="Productivity growth"
          value={params.productivityGrowth}
          display={`${(params.productivityGrowth * 100).toFixed(1)}% / yr`}
          hint="Incomes and living costs grow each year."
          onChange={onChange}
        />
        <Slider
          param="returnScale"
          label="Scale-dependent returns"
          value={params.returnScale}
          display={params.returnScale.toFixed(2)}
          hint="Bigger portfolios earn higher returns; deeper debts accrue faster."
          onChange={onChange}
        />
        <Slider
          param="incomeShock"
          label="Income volatility"
          value={params.incomeShock}
          display={`${(params.incomeShock * 100).toFixed(0)}%`}
          hint="Year-to-year random swings in individual income."
          onChange={onChange}
        />
      </Section>

      <Section title="Policy" isWide={isWide}>
        <Slider
          param="incomeTaxRate"
          label="Income tax & UBI"
          value={params.incomeTaxRate}
          display={formatPercent(params.incomeTaxRate, 0)}
          hint="Flat income tax pooled and paid out equally to everyone."
          onChange={onChange}
        />
        <Slider
          param="wealthTaxRate"
          label="Wealth tax"
          value={params.wealthTaxRate}
          display={`${(params.wealthTaxRate * 100).toFixed(1)}% / yr`}
          hint="Annual levy on positive wealth, rebated equally to everyone."
          onChange={onChange}
        />
        <Slider
          param="maxDebtYears"
          label="Borrowing limit"
          value={params.maxDebtYears}
          display={`${params.maxDebtYears.toFixed(1)} yrs income`}
          hint="Max debt in years of income. Spending is cut at the limit; beyond it, bankruptcy clears debts."
          onChange={onChange}
        />
        <Slider
          param="inheritanceRate"
          label="Inheritance passed on"
          value={params.inheritanceRate}
          display={`${Math.round(params.inheritanceRate * 100)}%`}
          hint="Share of an estate inherited by the heir. Rest vanishes (estate tax)."
          onChange={onChange}
        />
      </Section>

      <Section title="Risk" isWide={isWide}>
        <Slider
          param="crashProbability"
          label="Crash probability"
          value={params.crashProbability}
          display={formatPercent(params.crashProbability, 0)}
          hint="Chance of a market crash each year."
          onChange={onChange}
        />
        <Slider
          param="crashSeverity"
          label="Crash severity"
          value={params.crashSeverity}
          display={`${Math.round(params.crashSeverity * 100)}%`}
          hint="How much wealth a crash wipes out."
          onChange={onChange}
        />
      </Section>
    </div>
  );
});
