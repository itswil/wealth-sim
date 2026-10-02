# 💰 Wealth Simulator

An interactive agent-based simulator for exploring how wealth accumulates — and concentrates — across a whole population over 300 years.

Every person earns income on an age-based career curve that ends in retirement, pays a cost of living, saves a share of their surplus, earns investment returns that improve with portfolio size, and eventually dies. Their estate passes to a single heir, whose earning potential is partly inherited. Borrowing is capped by a credit limit and debts can trigger bankruptcy. Occasional market crashes hit portfolios unevenly.

By default returns are mildly **scale-dependent**, so larger portfolios earn more per dollar — one of the "rich get richer" engines at the heart of the simulator, alongside unbounded compounding. (Inheritance recycles estates to the next generation and lifts the bottom half's share; see [what actually drives concentration](#what-actually-drives-concentration).)

## ✨ Features

- **Fixed 300-year timeline** — the whole run is precomputed once; any control change re-runs it (~30ms at default population, ~170ms at 5,000).
- **Inspect any year** — hover or drag on the chart (mouse or touch), scrub the slider, use arrow keys (Shift for 10-year jumps), tap a jump preset, or press play to animate.
- **Two live visualisations**:
  - _Wealth over time_ — top 1% avg, mean, median, and bottom 50% avg per year, with direct line labels, a value readout for the active year, log/linear toggle, and playback progress bar.
  - _Wealth distribution_ — log-bucket histogram with the top 1% highlighted; hover or tap any bin for its range and count.
- **Headline stats** — total/mean/median wealth, wealth-to-income ratio, Gini, top 1% / bottom 50% shares.
- **Shareable URLs** — every parameter, seed, and year is serialized into the query string (debounced so playback doesn't flood the history API). Copy the URL to share an exact world.
- **Dark mode** — follows your system preference live, toggleable, persisted, with no flash on load.
- Colorblind-safe palette (Okabe-Ito) with distinct dash patterns per series.

## 🎛️ Controls

| Section        | Settings                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **World**      | Population (50–5,000), initial average wealth, regenerate / reset                                                             |
| **Inequality** | Low / Moderate / High / Extreme presets, income & initial-wealth spread                                                       |
| **Economy**    | Mean income, investment return, savings rate, cost of living, productivity growth, scale-dependent returns, income volatility |
| **Policy**     | Income tax & UBI, wealth tax (rebated equally), inheritance rate passed on, borrowing limit                                   |
| **Risk**       | Market crash probability & severity                                                                                           |

Any change re-runs the full simulation and updates every chart.

## 🧮 How the model works

Each simulated year, for every person:

1. Incomes and living costs grow by **productivity growth**.
2. They earn `meanIncome × talent × career(age) × shock`, where talent is log-normal (spread set by income inequality), careers peak around age 45 and taper after retirement at 70, and `shock` is a yearly log-normal draw (income volatility).
3. Wealth grows by an effective return: `returnRate × (1 + λ·|tanh(wealth / meanIncome)|)` — the magnitude of the balance sets the rate, so large portfolios earn more per dollar _and_ deep debts accrue faster than the baseline rate.
4. They consume `costOfLiving + (1 − savingsRate) × surplus` — except that consumption is cut before net worth can fall below the **borrowing limit** (`maxDebtYears × max(income, cost of living)`); if income loss leaves them beyond it anyway, bankruptcy clears their debts.
5. A flat **income tax** funds an equal **universal basic income**; the **wealth tax** on positive fortunes is likewise rebated equally to everyone.
6. A **market crash** may strike (iid each year): a random macro loss is applied to positive wealth only, scaled by a person-specific factor.
7. At death (Gompertz hazard rising from ~75, hard stop at 110), a positive estate × inheritance-rate passes to the respawned heir — their child; any debt passes on in full (the rate is an estate tax, not debt relief). The child enters at age 22–30 with inherited talent correlated to the parent's (ρ = 0.5), so fortunes and earning ability travel together down family lines.

The initial population draws log-normal talent and starting wealth correlated at ρ = 0.7, ages spread 22–74.

Stats — mean, median, Gini, top-1%/bottom-50% shares — are recomputed from the sorted wealth distribution every year, along with that year's mean income. The Lorenz-curve Gini is undefined once balances go negative (it divides by a total that debt shrinks), so it is measured on the population shifted up to be non-negative: the single worst-off agent counts as holding zero net worth. Top-1%/bottom-50% shares are reported only when total wealth is positive — a share of a negative or zero total is not a quantity, so the UI shows an em dash instead.

### What actually drives concentration

Two engines compound wealth without limit: **scale-dependent returns** (bigger balances earn more per dollar) and **uninterrupted compounding** (consumption never scales with wealth, so nothing throttles a large fortune). The distribution is **unimodal** at default settings — a single hump with a thin right tail, not two separate populations — and its _shape_ stabilises by roughly year 100:

| year                          | 50    | 100   | 150   | 200    | 250     | 300       |
| ----------------------------- | ----- | ----- | ----- | ------ | ------- | --------- |
| Gini                          | 0.552 | 0.630 | 0.637 | 0.642  | 0.641   | 0.646     |
| mean wealth (years of income) | 11    | 208   | 2,498 | 39,949 | 648,866 | 7,093,971 |

Because the effective return (5%) exceeds income growth (1%) and consumption is capped at living costs, the wealth-to-income ratio diverges: after year ~100 the run still changes, but only by multiplying everything by a constant. That is why the headline stats include **wealth ÷ income** — it is the stationary quantity, while nominal dollars reach the quadrillions. To study the distribution rather than the scale, read the Gini and shares; to study the scale, read the ratio.

Inheritance is a weak concentration lever on its own. Across six seeds at year 200, Gini lands in 0.46–0.66 with inheritance at 0%, 0.62–0.65 at 50%, and 0.64–0.65 at 100% — so passing estates on in full is marginally the _most_ concentrated of the three, and destroying them is the most variable. The clearest signal is the bottom half's share, which inheritance lifts sharply: 1.4–3.7% at 0% versus 5.2–7.9% when any estate survives. Recycling a fortune to a 22-year-old heir keeps it in the population instead of restarting each generation from zero.

The strongest levers are the **spread** parameters and the wealth tax, not the return engine (seed 42, year 200):

| scenario           | Gini  | top 1% | bottom 50% |
| ------------------ | ----- | ------ | ---------- |
| Moderate (default) | 0.642 | 8.4%   | 6.3%       |
| Low preset         | 0.481 | 4.8%   | 15.6%      |
| Extreme preset     | 0.871 | 25.9%  | 0.0%       |
| Wealth tax 5%/yr   | 0.006 | 1.0%   | 49.6%      |
| Inheritance 0%     | 0.458 | 10.6%  | 1.4%       |
| `returnScale = 0`  | 0.614 | 8.1%   | 7.8%       |
| `returnRate = 0`   | 0.556 | 10.0%  | −9.1%      |
| `savingsRate = 0`  | 0.945 | 36.6%  | −0.0%      |

Note how weak the return levers are: switching off scale dependence barely moves the Gini (0.64 → 0.61), and switching off returns entirely makes concentration _better_, not worse (0.56). With no compounding, wealth is pure accumulated savings — and because a negative bottom-50% share means that half is net indebted, the households that never generate a surplus never accumulate anything at all.

## ⚖️ Known limitations

- Consumption never scales with wealth, so nothing damps compounding and the wealth-to-income ratio grows without bound. Beyond roughly year 100 the horizon adds scale rather than insight.
- No families/marriage — single-child dynasties with correlated talent approximate lineage.
- Returns are homogeneous within a wealth level (no risk preferences or asset choice).
- Prices never fall: crashes hit nominal wealth but there is no deflation/recession channel for incomes.
- Debt carries interest equal to the effective return but has no other consequences (no credit-score effects).
- No common random numbers: the crash draw is conditional on the crash probability, so changing risk settings reshuffles the random stream and A/B comparisons carry Monte Carlo noise. Parameter changes that leave the draw count alone (inheritance, taxes, returns) _are_ directly comparable.

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
- Husky pre-commit hooks (format, lint, typecheck) and GitHub Actions CI (typecheck, lint, format check, tests, build)
