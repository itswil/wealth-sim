import { describe, expect, test } from "vitest";
import { DEFAULT_SEED, parseWorldFromSearch, serializeWorldToSearch } from "./url-state";
import { DEFAULT_PARAMS, MAX_YEAR } from "./sim";

describe("parseWorldFromSearch", () => {
  test("returns null for an empty query string", () => {
    expect(parseWorldFromSearch("")).toBeNull();
    expect(parseWorldFromSearch("?")).toBeNull();
  });

  test("parses valid params and leaves others at defaults", () => {
    const world = parseWorldFromSearch("?populationSize=250&seed=7&year=42");
    expect(world).not.toBeNull();
    expect(world?.params.populationSize).toBe(250);
    expect(Object.keys(world?.params ?? {})).toEqual(["populationSize"]);
    expect(world?.seed).toBe(7);
    expect(world?.year).toBe(42);
  });

  test("clamps out-of-range values into range", () => {
    const world = parseWorldFromSearch("?populationSize=99999&returnRate=5");
    expect(world?.params.populationSize).toBe(5000);
    expect(world?.params.returnRate).toBe(0.15);
  });

  test("drops invalid values but keeps valid siblings", () => {
    const world = parseWorldFromSearch("?populationSize=abc&returnRate=-3&savingsRate=0.2");
    expect(world?.params.populationSize).toBeUndefined();
    // Below-range values are clamped, not rejected.
    expect(world?.params.returnRate).toBe(0);
    expect(world?.params.savingsRate).toBe(0.2);
  });

  test("returns null when no known param matches", () => {
    expect(parseWorldFromSearch("?foo=1&bar=2")).toBeNull();
  });

  test("falls back to the default seed for missing or invalid seeds", () => {
    expect(parseWorldFromSearch("?populationSize=100")?.seed).toBe(DEFAULT_SEED);
    expect(parseWorldFromSearch("?populationSize=100&seed=nope")?.seed).toBe(DEFAULT_SEED);
    expect(parseWorldFromSearch("?populationSize=100&seed=-5")?.seed).toBe(DEFAULT_SEED);
    expect(parseWorldFromSearch("?populationSize=100&seed=1.5")?.seed).toBe(DEFAULT_SEED);
  });

  test("clamps year to MAX_YEAR and rejects negatives", () => {
    expect(parseWorldFromSearch("?populationSize=100&year=9999")?.year).toBe(MAX_YEAR);
    expect(parseWorldFromSearch("?populationSize=100&year=-10")?.year).toBe(0);
    expect(parseWorldFromSearch("?populationSize=100&year=x")?.year).toBe(0);
  });
});

describe("serializeWorldToSearch", () => {
  test("round-trips params, seed, and year through parse", () => {
    const search = serializeWorldToSearch({ ...DEFAULT_PARAMS, populationSize: 777 }, 123, 45);
    const world = parseWorldFromSearch(search);
    expect(world).not.toBeNull();
    expect(world?.params).toEqual({ ...DEFAULT_PARAMS, populationSize: 777 });
    expect(world?.seed).toBe(123);
    expect(world?.year).toBe(45);
  });

  test("produces values that survive clamping unchanged for in-range params", () => {
    const params = { ...DEFAULT_PARAMS, incomeTaxRate: 0.35 };
    const world = parseWorldFromSearch(serializeWorldToSearch(params, DEFAULT_SEED, 0));
    expect(world?.params.incomeTaxRate).toBeCloseTo(0.35, 12);
  });
});
