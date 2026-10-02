import { describe, expect, test } from "vitest";
import {
  DEFAULT_PARAMS,
  MAX_YEAR,
  buildHistogram,
  deathProbability,
  effectiveReturnRate,
  laborIncomeFactor,
  percentile,
  simulate,
  sortWealth,
  top1Bins,
  top1Count,
  type HistogramBin,
  type WorldParams,
} from "./sim";
import {
  formatMoney,
  formatMultiple,
  formatMultiplier,
  formatNumber,
  formatPercent,
} from "./format";

const baseParams: WorldParams = { ...DEFAULT_PARAMS, crashProbability: 0 };

const frozenWorld: WorldParams = {
  ...DEFAULT_PARAMS,
  populationSize: 500,
  incomeInequality: 0.1,
  initialInequality: 0.1,
  costOfLiving: 0,
  savingsRate: 0,
  maxDebtYears: 10,
  incomeTaxRate: 0,
  wealthTaxRate: 0,
  returnRate: 0,
  crashProbability: 0,
  productivityGrowth: 0,
  incomeShock: 0,
};

describe("simulate", () => {
  test("produces one snapshot per year including year 0", () => {
    const snapshots = simulate(baseParams, 42);
    expect(snapshots).toHaveLength(MAX_YEAR + 1);
    expect(snapshots[0].year).toBe(0);
    expect(snapshots[MAX_YEAR].year).toBe(MAX_YEAR);
  });

  test("is fully deterministic for a given seed", () => {
    const a = simulate(baseParams, 7, 80);
    const b = simulate(baseParams, 7, 80);
    expect(a).toEqual(b);
  });

  test("total wealth never increases when only crashes and inheritance act", () => {
    const params: WorldParams = {
      ...DEFAULT_PARAMS,
      populationSize: 500,
      meanIncome: 0,
      productivityGrowth: 0,
      incomeShock: 0,
      inheritanceRate: 1,
      wealthTaxRate: 0,
      incomeTaxRate: 0,
      costOfLiving: 0,
      savingsRate: 1,
      returnRate: 0,
      returnScale: 0.5,
      crashProbability: 0.5,
      maxDebtYears: 1000,
    };
    const snapshots = simulate(params, 3, 60);
    let previousTotal = snapshots[0].stats.total;
    for (const snap of snapshots) {
      // Inheritance conserves wealth; crashes only shrink positive wealth.
      expect(snap.stats.total).toBeLessThanOrEqual(previousTotal + 1e-6);
      previousTotal = snap.stats.total;
    }
  });

  test("zero borrowing limit keeps everyone non-negative", () => {
    const params: WorldParams = {
      ...DEFAULT_PARAMS,
      populationSize: 500,
      maxDebtYears: 0,
      costOfLiving: 30000,
      meanIncome: 20000,
    };
    const snapshots = simulate(params, 5, 80);
    for (const snap of snapshots) {
      for (let i = 0; i < snap.wealth.length; i++) {
        expect(snap.wealth[i]).toBeGreaterThanOrEqual(-1e-9);
      }
    }
  });

  test("tighter credit limits raise the observed wealth floor", () => {
    // Floors cluster near the limit because consumption freezes at the credit
    // line and bankruptcy resets clear any overshoot when limits shrink.
    const runFloor = (maxDebtYears: number) => {
      const params: WorldParams = { ...DEFAULT_PARAMS, populationSize: 500, maxDebtYears };
      const snapshots = simulate(params, 7, 120).slice(30);
      let floor = Infinity;
      for (const snap of snapshots) {
        for (const w of snap.wealth) floor = Math.min(floor, w);
      }
      return floor;
    };
    expect(runFloor(1)).toBeGreaterThan(runFloor(10));
  });

  test("wealth tax reduces total wealth over time", () => {
    const withTax = simulate({ ...baseParams, wealthTaxRate: 0.05 }, 42, 100);
    const withoutTax = simulate(baseParams, 42, 100);
    expect(withTax.at(-1)!.stats.total).toBeLessThan(withoutTax.at(-1)!.stats.total);
  });

  test("wealth tax narrows concentration via its equal rebate", () => {
    const withTax = simulate({ ...baseParams, wealthTaxRate: 0.02 }, 42, 100);
    const withoutTax = simulate(baseParams, 42, 100);
    expect(withTax.at(-1)!.stats.gini).toBeLessThan(withoutTax.at(-1)!.stats.gini);
  });

  test("flat income tax with universal basic income lowers inequality", () => {
    const withUbi = simulate({ ...baseParams, incomeTaxRate: 0.3 }, 42, 100);
    const withoutUbi = simulate(baseParams, 42, 100);
    expect(withUbi.at(-1)!.stats.gini).toBeLessThan(withoutUbi.at(-1)!.stats.gini);
  });

  test("productivity growth raises outcomes versus an otherwise identical world", () => {
    const params: WorldParams = { ...baseParams, crashProbability: 0, returnRate: 0 };
    const growing = simulate({ ...params, productivityGrowth: 0.02 }, 42, 100);
    const static_ = simulate({ ...params, productivityGrowth: 0 }, 42, 100);
    expect(growing.at(-1)!.stats.mean).toBeGreaterThan(static_.at(-1)!.stats.mean);
  });

  test("income volatility is mean-preserving", () => {
    const base: WorldParams = {
      ...DEFAULT_PARAMS,
      populationSize: 5000,
      initialWealth: 0,
      crashProbability: 0,
      costOfLiving: 0,
      savingsRate: 1,
      returnRate: 0,
      incomeTaxRate: 0,
      wealthTaxRate: 0,
      productivityGrowth: 0,
      incomeShock: 0,
    };
    const calm = simulate(base, 42, 1);
    const wild = simulate({ ...base, incomeShock: 0.4 }, 42, 1);
    const ratio = wild[1].stats.mean / calm[1].stats.mean;
    expect(ratio).toBeGreaterThan(0.98);
    expect(ratio).toBeLessThan(1.02);
  });

  test("a zero inheritance rate does not forgive debt", () => {
    const params: WorldParams = {
      ...frozenWorld,
      initialWealth: -1000,
      inheritanceRate: 0,
    };
    const final = simulate(params, 11, 120).at(-1)!;
    expect(final.stats.total).toBeLessThan(0);
  });

  test("a zero inheritance rate still dissipates positive estates", () => {
    const world: WorldParams = { ...frozenWorld, initialWealth: 1000 };
    const noInheritance = simulate({ ...world, inheritanceRate: 0 }, 11, 120).at(-1)!;
    const fullInheritance = simulate({ ...world, inheritanceRate: 1 }, 11, 120).at(-1)!;
    expect(noInheritance.stats.total).toBeLessThan(fullInheritance.stats.total);
  });
});

describe("gini", () => {
  test("stays within [0, 1] across a full run", () => {
    const snapshots = simulate(DEFAULT_PARAMS, 42);
    for (const snap of snapshots) {
      expect(snap.stats.gini).toBeGreaterThanOrEqual(0);
      expect(snap.stats.gini).toBeLessThanOrEqual(1);
    }
  });

  test("initial inequality parameter drives year-0 concentration", () => {
    const low = simulate(
      { ...DEFAULT_PARAMS, incomeInequality: 0.3, initialInequality: 0.3 },
      42,
      5,
    );
    const extreme = simulate(
      { ...DEFAULT_PARAMS, incomeInequality: 1.6, initialInequality: 2.0 },
      42,
      5,
    );
    expect(low[0].stats.gini).toBeLessThan(extreme[0].stats.gini);
  });
});

describe("demographic curves", () => {
  test("career factor peaks at 45", () => {
    expect(laborIncomeFactor(45)).toBeCloseTo(1.5, 4);
    expect(laborIncomeFactor(45)).toBeGreaterThan(laborIncomeFactor(44));
    expect(laborIncomeFactor(25)).toBeLessThan(laborIncomeFactor(45));
    expect(laborIncomeFactor(65)).toBeLessThan(laborIncomeFactor(45));
  });

  test("labor income collapses after retirement age", () => {
    expect(laborIncomeFactor(69)).toBeGreaterThan(0.5);
    expect(laborIncomeFactor(71)).toBeLessThan(0.5);
    expect(laborIncomeFactor(90)).toBeLessThan(0.01);
  });

  test("death probability rises with age and caps at 110", () => {
    expect(deathProbability(22)).toBeLessThan(deathProbability(60));
    expect(deathProbability(60)).toBeLessThan(deathProbability(90));
    expect(deathProbability(110)).toBe(1);
    expect(deathProbability(130)).toBe(1);
  });
});

describe("sortWealth", () => {
  test("sorts ascending without mutating input", () => {
    const input = Float64Array.from([3, -1, 2]);
    const sorted = sortWealth(input);
    expect([...sorted]).toEqual([-1, 2, 3]);
    expect([...input]).toEqual([3, -1, 2]);
  });
});

describe("percentile", () => {
  test("returns values from the sorted array", () => {
    const sorted = Float64Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(percentile(sorted, 0)).toBe(1);
    expect(percentile(sorted, 0.5)).toBe(5);
    expect(percentile(sorted, 0.99)).toBe(10);
    expect(percentile(sorted, 1)).toBe(10);
  });

  test("handles empty arrays", () => {
    expect(percentile(new Float64Array(0), 0.5)).toBe(0);
  });

  test("nearest-rank p99 is not the maximum for exactly 100 items", () => {
    const hundred = Float64Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(hundred, 0.99)).toBe(99);
    expect(percentile(hundred, 1)).toBe(100);
  });
});

describe("top1Count", () => {
  test("rounds to whole people with a floor of one", () => {
    expect(top1Count(1000)).toBe(10);
    expect(top1Count(100)).toBe(1);
    expect(top1Count(50)).toBe(1);
    expect(top1Count(150)).toBe(2);
  });
});

describe("top1Bins", () => {
  const makeBins = (counts: number[]): HistogramBin[] =>
    counts.map((count, i) => ({ min: i, max: i + 1, count }));

  test("marks only the bins holding the top 1%", () => {
    const bins = makeBins([40, 30, 20, 9, 1]);
    expect(top1Bins(bins, 100)).toEqual([false, false, false, false, true]);
    expect(top1Bins(bins, 1000)).toEqual([false, false, false, true, true]);
  });

  test("marks at least one bin even for tiny populations", () => {
    expect(top1Bins(makeBins([3, 2]), 5)).toEqual([false, true]);
  });

  test("skips empty bins at the top of the range", () => {
    expect(top1Bins(makeBins([5, 5, 0]), 100)).toEqual([false, true, false]);
  });

  test("flags the richest person's bin for a 50-person world (regression)", () => {
    const sorted = Float64Array.from({ length: 50 }, (_, i) => i + 1);
    const { bins } = buildHistogram(sorted, 120);
    const flags = top1Bins(bins, 50);
    expect(flags.some(Boolean)).toBe(true);
    expect(flags.at(-1)).toBe(true);
  });
});

describe("buildHistogram", () => {
  test("bins all positive values exactly once in log space", () => {
    const sorted = Float64Array.from([1, 10, 100, 1000]);
    const { bins, negatives } = buildHistogram(sorted, 10);
    expect(negatives).toBe(0);
    expect(bins.reduce((sum, b) => sum + b.count, 0)).toBe(4);
    const firstWithCount = bins.find((b) => b.count > 0);
    expect(firstWithCount?.min).toBeLessThanOrEqual(1);
    const lastWithCount = bins.filter((b) => b.count > 0).at(-1);
    expect(lastWithCount?.max).toBeGreaterThanOrEqual(1000 - 1e-9);
  });

  test("counts non-positives separately and excludes them from bins", () => {
    const sorted = Float64Array.from([-5, -1, 0, 10]);
    const { bins, negatives } = buildHistogram(sorted, 4);
    expect(negatives).toBe(3);
    expect(bins.reduce((sum, b) => sum + b.count, 0)).toBe(1);
  });

  test("returns no bins when every value is non-positive", () => {
    const result = buildHistogram(Float64Array.from([0, -3]), 8);
    expect(result.bins).toHaveLength(0);
    expect(result.negatives).toBe(2);
  });
});

describe("formatters", () => {
  test("formatMoney abbreviates magnitudes", () => {
    expect(formatMoney(0)).toBe("$0");
    expect(formatMoney(999)).toBe("$999");
    expect(formatMoney(1500)).toBe("$1.5K");
    expect(formatMoney(2_000_000)).toBe("$2M");
    expect(formatMoney(-3.4e9)).toBe("-$3.4B");
    expect(formatMoney(1e12)).toBe("$1T");
    expect(formatMoney(Number.NaN)).toBe("—");
  });

  test("formatMoney rounds cleanly across magnitude boundaries", () => {
    expect(formatMoney(999_999)).toBe("$1M");
    expect(formatMoney(1_000_000)).toBe("$1M");
  });

  test("formatNumber groups thousands", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  test("formatPercent", () => {
    expect(formatPercent(0.1234)).toBe("12.3%");
    expect(formatPercent(0.3, 0)).toBe("30%");
    expect(formatPercent(Number.NaN, 0)).toBe("—");
  });

  test("formatMultiplier switches precision at 10x", () => {
    expect(formatMultiplier(1.25)).toBe("1.3×");
    expect(formatMultiplier(12.34)).toBe("12×");
  });

  test("formatMoney extends past trillions", () => {
    expect(formatMoney(1e15)).toBe("$1Q");
    expect(formatMoney(6.6e15)).toBe("$6.6Q");
    expect(formatMoney(-2.5e15)).toBe("-$2.5Q");
  });

  test("formatMultiple abbreviates wealth-to-income ratios", () => {
    expect(formatMultiple(3.4)).toBe("3.4×");
    expect(formatMultiple(85.6)).toBe("86×");
    expect(formatMultiple(12_500)).toBe("12.5K×");
    expect(formatMultiple(6.68e6)).toBe("6.7M×");
    expect(formatMultiple(Number.NaN)).toBe("—");
  });
});

describe("effectiveReturnRate", () => {
  test("pays more on larger positive balances", () => {
    const rate = (wealth: number) => effectiveReturnRate(0.05, 0.5, wealth, 50_000);
    expect(rate(50_000)).toBeGreaterThan(rate(0));
    expect(rate(500_000)).toBeGreaterThan(rate(50_000));
  });

  test("charges more on deeper debts than on the baseline rate", () => {
    const rate = (wealth: number) => effectiveReturnRate(0.05, 0.5, wealth, 50_000);
    expect(rate(0)).toBeCloseTo(0.05, 12);
    // Regression: tanh is negative for negative balances, so the debt side used
    // to accrue *slower* than the baseline rate — the opposite of the docs.
    expect(rate(-5_000)).toBeGreaterThan(rate(0));
    expect(rate(-1_000_000)).toBeGreaterThan(rate(-5_000));
    // The scaling is bounded by returnRate * (1 + returnScale).
    expect(rate(-1e12)).toBeLessThanOrEqual(0.05 * 1.5 + 1e-12);
  });
});

describe("300-year horizon", () => {
  test("reports mean income so wealth can be read in years of income", () => {
    const snapshots = simulate({ ...DEFAULT_PARAMS, productivityGrowth: 0.02 }, 42, 10);
    expect(snapshots[0].stats.meanIncome).toBeCloseTo(DEFAULT_PARAMS.meanIncome, 6);
    expect(snapshots[10].stats.meanIncome).toBeCloseTo(
      DEFAULT_PARAMS.meanIncome * Math.pow(1.02, 10),
      6,
    );
  });

  test("the shape settles long before year 300 while the scale explodes", () => {
    const snapshots = simulate(DEFAULT_PARAMS, 42);
    const early = snapshots[100].stats;
    const late = snapshots[300].stats;
    expect(Math.abs(early.gini - late.gini)).toBeLessThan(0.02);
    expect(late.mean / late.meanIncome).toBeGreaterThan(1000 * (early.mean / early.meanIncome));
  });

  test("inheritance compresses concentration instead of building a dynastic tail", () => {
    // Measured regression: destroying estates at death restarts every
    // generation from zero, which concentrates *more* than recycling wealth to
    // heirs. The docs claimed the opposite.
    for (const seed of [7, 42]) {
      const none = simulate({ ...DEFAULT_PARAMS, inheritanceRate: 0 }, seed, 200).at(-1)!;
      const full = simulate({ ...DEFAULT_PARAMS, inheritanceRate: 1 }, seed, 200).at(-1)!;
      expect(none.stats.gini, `seed ${seed}`).toBeGreaterThan(full.stats.gini);
    }
  });
});
