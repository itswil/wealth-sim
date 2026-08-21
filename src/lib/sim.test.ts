import { describe, expect, test } from "vitest";
import {
  DEFAULT_PARAMS,
  MAX_YEAR,
  buildHistogram,
  percentile,
  simulate,
  sortWealth,
  type WorldParams,
} from "./sim";
import { formatMoney, formatMultiplier, formatNumber, formatPercent } from "./format";

const baseParams: WorldParams = { ...DEFAULT_PARAMS, crashProbability: 0 };

describe("simulate", () => {
  test("produces one snapshot per year including year 0", () => {
    const snapshots = simulate(baseParams, 42);
    expect(snapshots).toHaveLength(MAX_YEAR + 1);
    expect(snapshots[0].year).toBe(0);
    expect(snapshots[MAX_YEAR].year).toBe(MAX_YEAR);
  });

  test("is deterministic for a given seed", () => {
    const a = simulate(baseParams, 7);
    const b = simulate(baseParams, 7);
    expect(a[b.length - 1].stats).toEqual(b[b.length - 1].stats);
  });

  test("different seeds give different outcomes", () => {
    const a = simulate(baseParams, 1);
    const b = simulate(baseParams, 2);
    expect(a[MAX_YEAR].stats.gini).not.toEqual(b[MAX_YEAR].stats.gini);
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
    const snapshots = simulate(params, 3);
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
    const snapshots = simulate(params, 5);
    for (const snap of snapshots) {
      for (let i = 0; i < snap.wealth.length; i++) {
        expect(snap.wealth[i]).toBeGreaterThanOrEqual(-1e-9);
      }
    }
  });

  test("tighter credit limits raise the observed wealth floor", () => {
    const runFloor = (maxDebtYears: number) => {
      const params: WorldParams = { ...DEFAULT_PARAMS, populationSize: 500, maxDebtYears };
      const snapshots = simulate(params, 7);
      let floor = Infinity;
      for (const snap of snapshots.slice(50)) {
        for (const w of snap.wealth) floor = Math.min(floor, w);
      }
      return floor;
    };
    expect(runFloor(1)).toBeGreaterThan(runFloor(10));
  });

  test("wealth tax reduces total wealth over time", () => {
    const withTax = simulate({ ...baseParams, wealthTaxRate: 0.05 }, 42);
    const withoutTax = simulate(baseParams, 42);
    expect(withTax[MAX_YEAR].stats.total).toBeLessThan(withoutTax[MAX_YEAR].stats.total);
  });

  test("productivity growth raises incomes over time", () => {
    const growing = simulate(
      { ...baseParams, productivityGrowth: 0.02, crashProbability: 0, returnRate: 0 },
      42,
    );
    const static_ = simulate(baseParams, 42);
    // With growth, mean wealth outpaces a world with identical luck but no growth.
    expect(growing[MAX_YEAR].stats.mean).toBeGreaterThan(static_[MAX_YEAR].stats.mean);
  });

  test("retired elderly earn little or no labor income", () => {
    // Indirect check: with no capital returns, savings, or inheritance and high
    // costs, retirees drain to the credit limit while workers stay solvent.
    const params: WorldParams = {
      ...DEFAULT_PARAMS,
      populationSize: 400,
      initialWealth: 0,
      returnRate: 0,
      savingsRate: 0,
      inheritanceRate: 0,
      incomeShock: 0,
      productivityGrowth: 0,
      costOfLiving: 10000,
      maxDebtYears: 1,
      crashProbability: 0,
    };
    const snapshots = simulate(params, 80);
    const last = snapshots[MAX_YEAR];
    let inDebt = 0;
    for (const w of last.wealth) if (w < -1) inDebt += 1;
    expect(inDebt).toBeGreaterThan(0);
    expect(inDebt).toBeLessThan(last.wealth.length);
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
    const low = simulate({ ...DEFAULT_PARAMS, incomeInequality: 0.3, initialInequality: 0.3 }, 42);
    const extreme = simulate(
      { ...DEFAULT_PARAMS, incomeInequality: 1.6, initialInequality: 2.0 },
      42,
    );
    expect(low[0].stats.gini).toBeLessThan(extreme[0].stats.gini);
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
    expect(percentile(sorted, 0.5)).toBe(6);
    expect(percentile(sorted, 0.99)).toBe(10);
    expect(percentile(sorted, 1)).toBe(10);
  });

  test("handles empty arrays", () => {
    expect(percentile(new Float64Array(0), 0.5)).toBe(0);
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

  test("formatNumber groups thousands", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  test("formatPercent", () => {
    expect(formatPercent(0.1234)).toBe("12.3%");
  });

  test("formatMultiplier switches precision at 10x", () => {
    expect(formatMultiplier(1.25)).toBe("1.3×");
    expect(formatMultiplier(12.34)).toBe("12×");
  });
});
