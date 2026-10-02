import { describe, expect, test } from "vitest";
import { DEFAULT_PARAMS, PARAM_RANGES, type WorldParams } from "./sim";
import { URL_PARAM_RANGES } from "./url-state";

const KEYS = Object.keys(PARAM_RANGES) as (keyof WorldParams)[];

describe("PARAM_RANGES", () => {
  test("covers every parameter and nothing else", () => {
    expect([...KEYS].sort()).toEqual(Object.keys(DEFAULT_PARAMS).sort());
  });

  test("keeps the default parameters inside their own bounds", () => {
    for (const key of KEYS) {
      const { min, max } = PARAM_RANGES[key];
      expect(DEFAULT_PARAMS[key], key).toBeGreaterThanOrEqual(min);
      expect(DEFAULT_PARAMS[key], key).toBeLessThanOrEqual(max);
    }
  });

  test("has usable bounds and steps", () => {
    for (const key of KEYS) {
      const { min, max, step } = PARAM_RANGES[key];
      expect(min, key).toBeLessThan(max);
      expect(step, key).toBeGreaterThan(0);
      expect(step, key).toBeLessThanOrEqual(max - min);
    }
  });

  test("is the same contract the URL parser clamps to", () => {
    for (const key of KEYS) {
      expect(URL_PARAM_RANGES[key], key).toEqual([PARAM_RANGES[key].min, PARAM_RANGES[key].max]);
    }
  });
});
