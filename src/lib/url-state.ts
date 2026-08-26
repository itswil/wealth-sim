import { z } from "zod";
import { MAX_YEAR, type WorldParams } from "./sim";

export const DEFAULT_SEED = 42;

const SEED_MAX = 1e9 - 1;

export const URL_PARAM_RANGES: Record<keyof WorldParams, readonly [number, number]> = {
  populationSize: [50, 5000],
  meanIncome: [20000, 200000],
  incomeInequality: [0.1, 2],
  initialWealth: [0, 200000],
  initialInequality: [0.1, 2.5],
  costOfLiving: [0, 50000],
  returnRate: [0, 0.15],
  savingsRate: [0, 0.3],
  incomeTaxRate: [0, 0.8],
  wealthTaxRate: [0, 0.05],
  inheritanceRate: [0, 1],
  crashProbability: [0, 0.25],
  crashSeverity: [0, 0.8],
  maxDebtYears: [0, 10],
  returnScale: [0, 1],
  incomeShock: [0, 0.4],
  productivityGrowth: [0, 0.05],
};

// Coerces a raw query-string value to a finite number, or undefined if absent
// or unparseable — invalid values are dropped rather than rejected.
const sanitizedNumber = z.preprocess((raw) => {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}, z.number().optional());

const clampedParam = (range: readonly [number, number]): z.ZodType<number | undefined> =>
  sanitizedNumber.transform((n) =>
    n === undefined ? undefined : Math.min(range[1], Math.max(range[0], n)),
  );

const PARAM_FIELDS = Object.fromEntries(
  (Object.keys(URL_PARAM_RANGES) as (keyof WorldParams)[]).map((key) => [
    key,
    clampedParam(URL_PARAM_RANGES[key]),
  ]),
) as Record<keyof WorldParams, z.ZodType<number | undefined>>;

const seedField = sanitizedNumber.transform((n) =>
  n !== undefined && Number.isInteger(n) && n >= 0 && n <= SEED_MAX ? n : DEFAULT_SEED,
);

const yearField = sanitizedNumber.transform((n) => {
  if (n === undefined || !Number.isInteger(n) || n < 0) return 0;
  return Math.min(MAX_YEAR, n);
});

export interface UrlWorld {
  params: Partial<WorldParams>;
  seed: number;
  year: number;
}

export function parseWorldFromSearch(search: string): UrlWorld | null {
  const sp = new URLSearchParams(search);
  if (sp.size === 0) return null;
  const raw = Object.fromEntries(sp.entries());
  const params: Partial<WorldParams> = {};
  let matched = false;
  for (const key of Object.keys(URL_PARAM_RANGES) as (keyof WorldParams)[]) {
    const value = PARAM_FIELDS[key].parse(raw[key]);
    if (value !== undefined) {
      params[key] = value;
      matched = true;
    }
  }
  if (!matched) return null;
  return { params, seed: seedField.parse(raw.seed), year: yearField.parse(raw.year) };
}

export function readWorldFromUrl(): UrlWorld | null {
  if (typeof window === "undefined") return null;
  return parseWorldFromSearch(window.location.search);
}

export function serializeWorldToSearch(params: WorldParams, seed: number, year: number): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) sp.set(key, String(value));
  sp.set("seed", String(seed));
  sp.set("year", String(year));
  return `?${sp.toString()}`;
}
