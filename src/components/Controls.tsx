import type { ReactNode } from "react";
import type { WorldParams } from "../lib/sim";
import { PRESETS } from "../lib/sim";
import { formatMoney } from "../lib/format";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  hint?: string;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, step, display, hint, onChange }: SliderProps) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-xs font-semibold text-sky-700 tabular-nums">
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-sky-600"
      />
      {hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}
    </label>
  );
}

interface SectionProps {
  title: string;
  children: ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="space-y-3 border-t border-slate-200 px-4 py-4 first:border-t-0">
      <h3 className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">{title}</h3>
      {children}
    </div>
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

export function Controls({
  params,
  presetId,
  onChange,
  onPreset,
  onNewWorld,
  onReset,
}: ControlsProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-bold text-slate-800">Simulation controls</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onNewWorld}
            className="rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
          >
            New world
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            Reset
          </button>
        </div>
      </div>

      <Section title="World">
        <div className="space-y-1">
          <p className="text-xs text-slate-500">
            Any change re-runs the 300-year simulation and updates every chart.
          </p>
          <Slider
            label="Population"
            value={params.populationSize}
            min={50}
            max={5000}
            step={50}
            display={`${params.populationSize.toLocaleString()} people`}
            onChange={(v) => onChange({ populationSize: v })}
          />
          <Slider
            label="Initial wealth (avg)"
            value={params.initialWealth}
            min={0}
            max={200000}
            step={1000}
            display={formatMoney(params.initialWealth)}
            hint="Baseline wealth handed to each person at year 0."
            onChange={(v) => onChange({ initialWealth: v })}
          />
        </div>
      </Section>

      <Section title="Inequality">
        <div className="grid grid-cols-4 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPreset(p.id)}
              className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                presetId === p.id
                  ? "bg-sky-600 text-white"
                  : "border border-slate-300 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          {PRESETS.find((p) => p.id === presetId)?.blurb ?? ""}
        </p>
        <Slider
          label="Income inequality"
          value={params.incomeInequality}
          min={0.1}
          max={2}
          step={0.05}
          display={params.incomeInequality.toFixed(2)}
          hint="Spread of the income distribution (higher = wider)."
          onChange={(v) => onChange({ incomeInequality: v })}
        />
        <Slider
          label="Initial wealth inequality"
          value={params.initialInequality}
          min={0.1}
          max={2.5}
          step={0.05}
          display={params.initialInequality.toFixed(2)}
          hint="How concentrated starting wealth is."
          onChange={(v) => onChange({ initialInequality: v })}
        />
      </Section>

      <Section title="Economy">
        <Slider
          label="Mean income"
          value={params.meanIncome}
          min={20000}
          max={200000}
          step={1000}
          display={formatMoney(params.meanIncome)}
          hint="Peak-earning average. Careers rise and fall with age."
          onChange={(v) => onChange({ meanIncome: v })}
        />
        <Slider
          label="Investment return"
          value={params.returnRate}
          min={0}
          max={0.15}
          step={0.005}
          display={`${(params.returnRate * 100).toFixed(1)}% / yr`}
          hint="Returns compound on existing wealth — the rich get richer."
          onChange={(v) => onChange({ returnRate: v })}
        />
        <Slider
          label="Savings rate"
          value={params.savingsRate}
          min={0}
          max={0.3}
          step={0.005}
          display={`${(params.savingsRate * 100).toFixed(1)}%`}
          hint="Share of income saved after living costs."
          onChange={(v) => onChange({ savingsRate: v })}
        />
        <Slider
          label="Cost of living"
          value={params.costOfLiving}
          min={0}
          max={50000}
          step={500}
          display={formatMoney(params.costOfLiving)}
          hint="Fixed yearly costs everyone must pay. Bites the poor hardest."
          onChange={(v) => onChange({ costOfLiving: v })}
        />
      </Section>

      <Section title="Policy">
        <Slider
          label="Income tax & UBI"
          value={params.incomeTaxRate}
          min={0}
          max={0.8}
          step={0.01}
          display={formatPercentValue(params.incomeTaxRate)}
          hint="Flat income tax pooled and paid out equally to everyone."
          onChange={(v) => onChange({ incomeTaxRate: v })}
        />
        <Slider
          label="Wealth tax"
          value={params.wealthTaxRate}
          min={0}
          max={0.05}
          step={0.001}
          display={`${(params.wealthTaxRate * 100).toFixed(1)}% / yr`}
          hint="Annual levy on positive wealth, removed from the model."
          onChange={(v) => onChange({ wealthTaxRate: v })}
        />
        <Slider
          label="Inheritance passed on"
          value={params.inheritanceRate}
          min={0}
          max={1}
          step={0.01}
          display={`${Math.round(params.inheritanceRate * 100)}%`}
          hint="Share of an estate inherited by heirs. Rest vanishes (estate tax)."
          onChange={(v) => onChange({ inheritanceRate: v })}
        />
      </Section>

      <Section title="Risk">
        <Slider
          label="Crash probability"
          value={params.crashProbability}
          min={0}
          max={0.25}
          step={0.005}
          display={formatPercentValue(params.crashProbability)}
          hint="Chance of a market crash each year."
          onChange={(v) => onChange({ crashProbability: v })}
        />
        <Slider
          label="Crash severity"
          value={params.crashSeverity}
          min={0}
          max={0.8}
          step={0.01}
          display={`${Math.round(params.crashSeverity * 100)}%`}
          hint="How much wealth a crash wipes out."
          onChange={(v) => onChange({ crashSeverity: v })}
        />
      </Section>
    </div>
  );
}

function formatPercentValue(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}
