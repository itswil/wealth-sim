# 💰 Wealth Simulator

An interactive agent-based simulator for exploring how wealth accumulates — and concentrates — across a whole population over 300 years.

Every person earns income on an age-based career curve that ends in retirement, pays a cost of living, saves a share of their surplus, earns investment returns that improve with portfolio size, and eventually dies. Their estate passes to a single heir, whose earning potential is partly inherited. Borrowing is capped by a credit limit and debts can trigger bankruptcy. Occasional market crashes hit portfolios unevenly.

By default returns are mildly **scale-dependent**, so larger portfolios earn more per dollar — one of the "rich get richer" engines at the heart of the simulator, alongside compounding and inheritance.

## ✨ Features

- **Fixed 300-year timeline** — the whole run is precomputed once; any control change re-runs it (~50ms at default population).
- **Inspect any year** — hover or drag on the chart (mouse or touch), scrub the slider, use arrow keys (Shift for 10-year jumps), tap a jump preset, or press play to animate.
- **Two live visualisations**:
  - _Wealth over time_ — top 1% avg, mean, median, and bottom 50% avg per year, with direct line labels, a value readout for the active year, log/linear toggle, and playback progress bar.
  - _Wealth distribution_ — log-bucket histogram with the top 1% highlighted; hover or tap any bin for its range and count.
- **Headline stats** — total/mean/median wealth, Gini, top 1% / bottom 50% shares.
- **Shareable URLs** — every parameter, seed, and year is serialized into the query string. Copy the URL to share an exact world.
- **Dark mode** — follows your system preference, toggleable, persisted.
- Colorblind-safe palette (Okabe-Ito) with distinct dash patterns per series.

## 🎛️ Controls

| Section        | Settings                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| **World**      | Population (50–5,000), initial average wealth, regenerate / reset                                                  |
| **Inequality** | Low / Moderate / High / Extreme presets, income & initial-wealth spread                                            |
| **Economy**    | Mean income, investment return, savings rate, cost of living, productivity growth, scale-dependent returns, income volatility |
| **Policy**     | Income tax & UBI, wealth tax (rebated equally), inheritance rate passed on, borrowing limit                         |
| **Risk**       | Market crash probability & severity                                                                                |

Any change re-runs the full simulation and updates every chart.

## 🧮 How the model works

Each simulated year, for every person:

1. Incomes and living costs grow by **productivity growth**.
2. They earn `meanIncome × talent × career(age) × shock`, where talent is log-normal (spread set by income inequality), careers peak around age 45 and taper after retirement at 70, and `shock` is a yearly log-normal draw (income volatility).
3. Wealth grows by an effective return: `returnRate × (1 + λ·tanh(wealth / meanIncome))` — positive balances earn more as they grow; debt gets more expensive as it deepens.
4. They consume `costOfLiving + (1 − savingsRate) × surplus` — except that consumption is cut before net worth can fall below the **borrowing limit** (`maxDebtYears × max(income, cost of living)`); if income loss leaves them beyond it anyway, bankruptcy clears their debts.
5. A flat **income tax** funds an equal **universal basic income**; the **wealth tax** on positive fortunes is likewise rebated equally to everyone.
6. A **market crash** may strike (iid each year): a random macro loss is applied to positive wealth only, scaled by a person-specific factor.
7. At death (Gompertz hazard rising from ~75, hard stop at 110), the estate × inheritance-rate passes intact to the respawned heir — their child. The child enters at age 22–30 with inherited talent correlated to the parent's (ρ = 0.5), so fortunes and earning ability travel together down family lines.

The initial population draws log-normal talent and starting wealth correlated at ρ = 0.7, ages spread 22–74.

Stats — mean, median, Gini, top-1%/bottom-50% shares — are recomputed from the sorted wealth distribution every year.

### Why it bifurcates

Wealth accumulates through two regimes: bounded additive **savings** (reset each generation) and unbounded multiplicative **compounding** (preserved via dynastic inheritance). The result separates into a mass hump and a dynastic hump. Set **inheritance to 0%** to collapse this toward a single smooth distribution — a nice demonstration that inheritance plus compounding drive the top tail.

## ⚖️ Known limitations

- No families/marriage — single-child dynasties with correlated talent approximate lineage.
- Returns are homogeneous within a wealth level (no risk preferences or asset choice).
- Prices never fall: crashes hit nominal wealth but there is no deflation/recession channel for incomes.
- Debt carries interest equal to the effective return but has no other consequences (no credit-score effects).

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
pnpm test     # Run tests (node project + headless Chromium browser project)
```

## 🛠️ Stack

- React 19 + TypeScript
- Vite
- TailwindCSS v4 (light & dark)
- oxlint + oxfmt
- Vitest: node project for pure logic, headless Chromium via `@vitest/browser-playwright` for components
- Husky pre-commit hooks
