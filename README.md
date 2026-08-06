# 💰 Wealth Simulator

An interactive agent-based simulator for exploring how wealth accumulates — and concentrates — across a whole population over time.

Every person earns income on an age-based career curve, pays a flat cost of living, saves a share of their surplus, earns compounding investment returns on existing wealth, and eventually dies. Their estate is passed to random heirs (or lost, via estate policy). Occasional market crashes wipe out a slice of everyone's wealth.

By default everyone gets the same deterministic 5% annual return, so compounding favors whoever starts with more — the "rich get richer" engine at the heart of the simulator.

## ✨ Features

- **Fixed 300-year timeline** — the whole run is precomputed once. Any control change re-runs it.
- **Hover-to-inspect** — hover the _Wealth over time_ chart (or drag the year slider) to see that year's distribution and headline stats.
- **Two live visualisations**:
  - _Wealth over time_ — top 1% avg, mean, median, and bottom 50% avg wealth per year (log/linear toggle).
  - _Wealth distribution_ — log-bucket histogram with the current top 1% highlighted.
- **Headline stats** — year, population, total/mean/median wealth, Gini, and top 1% / bottom 50% wealth shares.

## 🎛️ Controls

| Section        | Settings                                                                |
| -------------- | ----------------------------------------------------------------------- |
| **World**      | Population (50–5,000), initial wealth per person, regenerate / reset    |
| **Inequality** | Low / Moderate / High / Extreme presets, income & initial-wealth spread |
| **Economy**    | Mean income, investment return, savings rate, cost of living            |
| **Policy**     | Income tax & UBI, wealth tax, inheritance rate passed on                |
| **Risk**       | Market crash probability & severity                                     |

Any change to these re-runs the full simulation and updates every chart.

## 🧮 How the model works

Each simulated year, for every person:

1. Wealth grows by the **investment return** (compounds, even on debt).
2. They earn income = `meanIncome × incomeFactor × careerFactor(age)`, where income is drawn from a log-normal distribution (skewed by the inequality preset) and careers rise and fall with age.
3. They pay the flat **cost of living**, then **save a share of the surplus** (income above that floor). Below the floor, deficits drain wealth.
4. Progressive income tax is pooled and paid back as a **universal basic income**; a **wealth tax** is removed from the model.
5. Age advances; at death the estate is split between two random heirs (the "inheritance passed on" share) and the person respawns with zero wealth and new income potential.
6. A **market crash** may multiply everyone's wealth by a loss factor.

The stats — mean, median, Gini, top-1% share, etc. — are recomputed from the sorted wealth distribution every year.

### Why it bifurcates

Wealth accumulates through two regimes: bounded additive **savings** (reset at death) and unbounded multiplicative **compounding** (preserved across generations via inheritance). With a uniform return and winner-take-all inheritance, the two regimes separate into a mass hump and a dynastic hump with an empty gap between them. Set **inheritance to 0%** to collapse this to a single smooth distribution — a nice demonstration that inheritance + compounding drive the top tail. (Real economies smooth this into a Pareto tail via heterogeneous returns, estate taxes, large labor incomes, and redistribution.)

## 🚀 Getting Started

```bash
pnpm i
pnpm dev
```

## ⚡ Commands

```bash
pnpm dev      # Start dev server
pnpm build    # Build for production
pnpm preview  # Preview production build
pnpm fmt      # Format code (oxfmt)
pnpm lint     # Lint (oxlint)
pnpm test     # Run tests (headless Chromium via vitest browser mode)
```

## 🛠️ Stack

- React 19 + TypeScript
- Vite
- TailwindCSS v4 (light mode only)
- oxlint + oxfmt
- Vitest with `@vitest/browser-playwright` (headless)
- Husky pre-commit, pre-push hooks
