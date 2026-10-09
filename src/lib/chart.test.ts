import { describe, expect, test } from "vitest";
import {
  CHART_LAYOUT,
  DEBT_STRIP_HEIGHT,
  makePlotY,
  makeX,
  makeY,
  makeYScale,
  niceTicks,
} from "./chart";

describe("niceTicks", () => {
  test("returns round steps covering the range", () => {
    expect(niceTicks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
  });

  test("returns a single tick instead of looping on a flat range", () => {
    expect(niceTicks(50, 50, 4)).toEqual([50]);
    expect(niceTicks(50, 40, 4)).toEqual([50]);
  });

  test("never returns ticks outside the data range", () => {
    const ranges: [number, number][] = [
      [-300, 900],
      [0.001, 0.009],
      [1e6, 9.7e6],
    ];
    for (const [lo, hi] of ranges) {
      const ticks = niceTicks(lo, hi, 6);
      expect(ticks.length).toBeGreaterThan(0);
      for (const t of ticks) {
        expect(t).toBeGreaterThanOrEqual(lo - 1e-9);
        expect(t).toBeLessThanOrEqual(hi + 1e-9);
      }
    }
  });
});

describe("makeYScale", () => {
  test("linear scale uses the raw data bounds", () => {
    const scale = makeYScale(0, 100, false);
    expect(scale.lo).toBe(0);
    expect(scale.hi).toBe(100);
    expect(scale.span).toBe(100);
  });

  test("log scale works in log10 space above a positive floor", () => {
    const scale = makeYScale(-5, 1000, true);
    expect(scale.lo).toBe(0); // floor is max(1000e-4, 1) = 1
    expect(scale.hi).toBe(3);
    expect(scale.transform(1)).toBe(0);
    expect(scale.transform(1000)).toBe(3);
  });

  test("clamps non-positive values to the floor rather than returning NaN", () => {
    const scale = makeYScale(-5, 1000, true);
    expect(scale.transform(-5)).toBe(scale.transform(1));
    expect(Number.isFinite(scale.transform(-1e12))).toBe(true);
  });

  test("keeps a non-zero span when the range is flat", () => {
    const scale = makeYScale(5, 5, false);
    expect(scale.span).toBe(1);
    expect(Number.isFinite(makeY(scale, 10, 100)(5))).toBe(true);
  });

  test("reports whether the axis is actually logarithmic", () => {
    expect(makeYScale(1, 1000, true).log).toBe(true);
    expect(makeYScale(1, 1000, false).log).toBe(false);
  });

  test("falls back to linear when the whole series is non-positive", () => {
    // Log10 is undefined at or below zero, so a fully-indebted population has
    // no log axis: every value clamps to the floor and the series flattens onto
    // one line. Reported via `log` so the caller can label it correctly.
    const scale = makeYScale(-500_000, -100_000, true);
    expect(scale.log).toBe(false);
    expect(scale.lo).toBe(-500_000);
    expect(scale.hi).toBe(-100_000);
    const y = makeY(scale, 0, 100);
    // A real range, not four series collapsed onto one line.
    expect(y(-100_000)).toBeCloseTo(0, 10);
    expect(y(-500_000)).toBeCloseTo(100, 10);
    expect(y(-300_000)).toBeCloseTo(50, 10);
  });

  test("falls back to linear when every value is exactly zero", () => {
    const scale = makeYScale(0, 0, true);
    expect(scale.log).toBe(false);
    expect(Number.isFinite(scale.transform(0))).toBe(true);
  });

  test("still uses log space when only some values are non-positive", () => {
    // Mixed populations have a positive max, so a log axis is meaningful and
    // negatives clamp to the floor as before.
    const scale = makeYScale(-500_000, 1000, true);
    expect(scale.log).toBe(true);
    expect(scale.transform(-500_000)).toBe(scale.transform(1));
  });
});

describe("makePlotY", () => {
  test("gives debt a linear strip under a log axis", () => {
    const scale = makeYScale(-500_000, 1000, true);
    expect(scale.log).toBe(true);
    const { stripH, stripTop, y } = makePlotY(scale, -500_000, 14, 278);
    expect(stripH).toBe(DEBT_STRIP_HEIGHT);
    // $0 is the boundary between strip and log region; the deepest debt
    // sits at the very bottom, spread linearly between.
    expect(y(0)).toBe(stripTop);
    expect(y(-500_000)).toBe(stripTop + stripH);
    expect(y(-250_000)).toBeCloseTo(stripTop + stripH / 2, 10);
    // Positive values stay on the log region above the strip.
    expect(y(1000)).toBeLessThan(stripTop);
  });

  test("adds no strip on a linear axis, where debt renders natively", () => {
    const scale = makeYScale(-500_000, 1000, false);
    const { stripH, y } = makePlotY(scale, -500_000, 14, 278);
    expect(stripH).toBe(0);
    expect(y(-500_000)).toBe(14 + 278);
    expect(y(1000)).toBe(14);
  });

  test("adds no strip when nothing dips below zero", () => {
    const scale = makeYScale(5, 1000, true);
    expect(makePlotY(scale, 5, 14, 278).stripH).toBe(0);
  });
});

describe("makeY and makeX", () => {
  test("maps the y range top-down across the inner height", () => {
    const scale = makeYScale(0, 100, false);
    const y = makeY(scale, CHART_LAYOUT.paddingTop, 100);
    expect(y(100)).toBe(CHART_LAYOUT.paddingTop);
    expect(y(0)).toBe(CHART_LAYOUT.paddingTop + 100);
    expect(y(50)).toBeCloseTo(CHART_LAYOUT.paddingTop + 50, 10);
  });

  test("maps years left-to-right across the inner width", () => {
    const x = makeX(0, 300, 74, 600);
    expect(x(0)).toBe(74);
    expect(x(300)).toBe(674);
    expect(x(150)).toBeCloseTo(374, 10);
  });

  test("does not divide by zero on a single-year range", () => {
    const x = makeX(50, 50, 74, 600);
    expect(Number.isFinite(x(50))).toBe(true);
    expect(x(50)).toBe(74);
  });
});
