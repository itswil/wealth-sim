export interface WorldParams {
  populationSize: number;
  meanIncome: number;
  incomeInequality: number;
  initialWealth: number;
  initialInequality: number;
  costOfLiving: number;
  returnRate: number;
  savingsRate: number;
  incomeTaxRate: number;
  wealthTaxRate: number;
  inheritanceRate: number;
  crashProbability: number;
  crashSeverity: number;
  maxDebtYears: number;
  returnScale: number;
  incomeShock: number;
  productivityGrowth: number;
}

export const DEFAULT_PARAMS: WorldParams = {
  populationSize: 1000,
  meanIncome: 50000,
  incomeInequality: 0.7,
  initialWealth: 10000,
  initialInequality: 0.9,
  costOfLiving: 15000,
  returnRate: 0.05,
  savingsRate: 0.1,
  incomeTaxRate: 0,
  wealthTaxRate: 0,
  inheritanceRate: 1,
  crashProbability: 0.03,
  crashSeverity: 0.35,
  maxDebtYears: 3,
  returnScale: 0.5,
  incomeShock: 0.1,
  productivityGrowth: 0.01,
};

export interface ParamRange {
  min: number;
  max: number;
  step: number;
}

/**
 * The single source of truth for every parameter's bounds. The control panel
 * renders from these and the URL parser clamps to them, so a slider can never
 * disagree with what a shared link accepts.
 */
export const PARAM_RANGES: Record<keyof WorldParams, ParamRange> = {
  populationSize: { min: 50, max: 5000, step: 50 },
  meanIncome: { min: 20000, max: 200000, step: 1000 },
  incomeInequality: { min: 0.1, max: 2, step: 0.05 },
  initialWealth: { min: 0, max: 200000, step: 1000 },
  initialInequality: { min: 0.1, max: 2.5, step: 0.05 },
  costOfLiving: { min: 0, max: 50000, step: 500 },
  returnRate: { min: 0, max: 0.15, step: 0.005 },
  savingsRate: { min: 0, max: 0.3, step: 0.005 },
  incomeTaxRate: { min: 0, max: 0.8, step: 0.01 },
  wealthTaxRate: { min: 0, max: 0.05, step: 0.001 },
  inheritanceRate: { min: 0, max: 1, step: 0.01 },
  crashProbability: { min: 0, max: 0.25, step: 0.005 },
  crashSeverity: { min: 0, max: 0.8, step: 0.01 },
  maxDebtYears: { min: 0, max: 10, step: 0.5 },
  returnScale: { min: 0, max: 1, step: 0.05 },
  incomeShock: { min: 0, max: 0.4, step: 0.01 },
  productivityGrowth: { min: 0, max: 0.05, step: 0.005 },
};

export interface InequalityPreset {
  id: string;
  label: string;
  blurb: string;
  incomeInequality: number;
  initialInequality: number;
}

export const PRESETS: InequalityPreset[] = [
  {
    id: "low",
    label: "Low",
    blurb: "Egalitarian, social-democratic style.",
    incomeInequality: 0.3,
    initialInequality: 0.3,
  },
  {
    id: "moderate",
    label: "Moderate",
    blurb: "Typical Western economy.",
    incomeInequality: 0.7,
    initialInequality: 0.9,
  },
  {
    id: "high",
    label: "High",
    blurb: "Concentrated pay and ownership.",
    incomeInequality: 1.1,
    initialInequality: 1.4,
  },
  {
    id: "extreme",
    label: "Extreme",
    blurb: "Oligarchy / feudal concentration.",
    incomeInequality: 1.6,
    initialInequality: 2.0,
  },
];

export interface YearStats {
  year: number;
  total: number;
  mean: number;
  median: number;
  gini: number;
  top1Avg: number;
  bottom50Avg: number;
  /**
   * Fraction of total wealth held by the top 1% / bottom 50%. `NaN` when the
   * population's total is not positive — there is no pie to divide, and the
   * ratio inverts into nonsense once the total goes negative. Formatters render
   * `NaN` as an em dash.
   */
  top1Share: number;
  bottom50Share: number;
  /**
   * The year's mean income level (it drifts with productivity growth). Wealth
   * grows far faster than income, so `mean / meanIncome` — net worth in years
   * of income — is the only stationary way to read the headline numbers.
   */
  meanIncome: number;
}

export interface SimulationSnapshot {
  year: number;
  stats: YearStats;
  wealth: Float64Array;
  /**
   * `wealth` in ascending order. Carried from the stats pass, which has to sort
   * anyway, so consumers never pay for a second sort. Only valid immediately
   * after `computeStats`, which every `step` performs.
   */
  sorted: Float64Array;
}

export const MAX_YEAR = 300;

export function simulate(
  params: WorldParams,
  seed: number,
  maxYear: number = MAX_YEAR,
): SimulationSnapshot[] {
  const sim = new Simulation(seed, params);
  const snapshots: SimulationSnapshot[] = [sim.snapshot()];
  for (let y = 0; y < maxYear; y++) {
    sim.step(params);
    snapshots.push(sim.snapshot());
  }
  return snapshots;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGaussian(rng: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    let s = 0;
    do {
      u = rng() * 2 - 1;
      v = rng() * 2 - 1;
      s = u * u + v * v;
    } while (s === 0 || s >= 1);
    const mul = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * mul;
    return u * mul;
  };
}

export const DEMOGRAPHICS = {
  entryAgeMin: 22,
  entryAgeSpan: 8,
  careerPeakAge: 45,
  careerBase: 0.6,
  careerBoost: 0.9,
  careerSpread: 512,
  retirementAge: 70,
  retirementSteepness: 2,
  maxAge: 110,
  deathRateAt75: 0.02,
  deathAgeScale: 7,
} as const;

export const CORRELATIONS = {
  incomeWealth: 0.7,
  intergenerational: 0.5,
} as const;

export function careerFactor(age: number): number {
  const { careerBase, careerBoost, careerPeakAge, careerSpread } = DEMOGRAPHICS;
  return (
    careerBase +
    careerBoost * Math.exp(-((age - careerPeakAge) * (age - careerPeakAge)) / careerSpread)
  );
}

const RETIREMENT_AGE = DEMOGRAPHICS.retirementAge;

function employmentFactor(age: number): number {
  return 1 / (1 + Math.exp((age - RETIREMENT_AGE) / DEMOGRAPHICS.retirementSteepness));
}

export function laborIncomeFactor(age: number): number {
  return careerFactor(age) * employmentFactor(age);
}

export function deathProbability(age: number): number {
  if (age >= DEMOGRAPHICS.maxAge) return 1;
  return Math.min(
    1,
    DEMOGRAPHICS.deathRateAt75 * Math.exp((age - 75) / DEMOGRAPHICS.deathAgeScale),
  );
}

/**
 * The yearly growth rate applied to a balance. Returns scale with the size of
 * the balance, so large portfolios earn more per dollar and deep debts accrue
 * faster than shallow ones — the debt half of the domain is deliberately more
 * expensive than `returnRate`, not cheaper.
 */
export function effectiveReturnRate(
  returnRate: number,
  returnScale: number,
  wealth: number,
  meanIncome: number,
): number {
  const ref = Math.max(1, meanIncome);
  return returnRate * (1 + returnScale * Math.abs(Math.tanh(wealth / ref)));
}

export class Simulation {
  readonly n: number;
  readonly wealth: Float64Array;
  readonly incomeFactor: Float64Array;
  readonly age: Float64Array;
  year = 0;
  currentStats: YearStats;

  private readonly sorted: Float64Array;
  private readonly income: Float64Array;
  private readonly rng: () => number;
  private readonly gauss: () => number;
  private readonly sigmaI: number;
  private readonly incomeNorm: number;
  private readonly wealthNorm: number;
  private readonly rho = CORRELATIONS.incomeWealth;

  private meanIncome: number;
  private costOfLiving: number;

  constructor(seed: number, params: WorldParams) {
    this.n = Math.max(2, Math.floor(params.populationSize));
    this.wealth = new Float64Array(this.n);
    this.incomeFactor = new Float64Array(this.n);
    this.age = new Float64Array(this.n);
    this.sorted = new Float64Array(this.n);
    this.income = new Float64Array(this.n);
    this.rng = mulberry32(seed);
    this.gauss = makeGaussian(this.rng);
    this.sigmaI = params.incomeInequality;
    this.incomeNorm = Math.exp((this.sigmaI * this.sigmaI) / 2);
    this.wealthNorm = Math.exp((params.initialInequality * params.initialInequality) / 2);
    this.meanIncome = params.meanIncome;
    this.costOfLiving = params.costOfLiving;
    const rho = this.rho;
    const rho2 = Math.sqrt(1 - rho * rho);
    for (let i = 0; i < this.n; i++) {
      const zI = this.gauss();
      const zW = rho * zI + rho2 * this.gauss();
      this.incomeFactor[i] = Math.exp(this.sigmaI * zI) / this.incomeNorm;
      this.wealth[i] =
        (params.initialWealth * Math.exp(params.initialInequality * zW)) / this.wealthNorm;
      this.age[i] = DEMOGRAPHICS.entryAgeMin + this.rng() * 52;
    }
    this.currentStats = this.computeStats();
  }

  snapshot(): SimulationSnapshot {
    return {
      year: this.year,
      stats: this.currentStats,
      wealth: this.wealth.slice(),
      sorted: this.sorted.slice(),
    };
  }

  step(p: WorldParams): void {
    const { wealth, incomeFactor, income, age, n } = this;
    this.year += 1;

    const growth = 1 + p.productivityGrowth;
    this.meanIncome *= growth;
    this.costOfLiving *= growth;

    const shockNorm = Math.exp((p.incomeShock * p.incomeShock) / 2);
    for (let i = 0; i < n; i++) {
      const shock = Math.exp(p.incomeShock * this.gauss()) / shockNorm;
      income[i] = this.meanIncome * incomeFactor[i] * laborIncomeFactor(age[i]) * shock;
    }

    let taxPool = 0;
    for (let i = 0; i < n; i++) {
      taxPool += p.incomeTaxRate * income[i];
    }
    const ubi = taxPool / n;

    let wealthTaxPool = 0;
    for (let i = 0; i < n; i++) {
      const effReturn = effectiveReturnRate(
        p.returnRate,
        p.returnScale,
        wealth[i],
        this.meanIncome,
      );
      wealth[i] *= 1 + effReturn;

      if (p.wealthTaxRate > 0 && wealth[i] > 0) {
        const levy = wealth[i] * p.wealthTaxRate;
        wealthTaxPool += levy;
        wealth[i] -= levy;
      }

      const surplus = Math.max(0, income[i] - this.costOfLiving);
      const desiredConsumption = this.costOfLiving + (1 - p.savingsRate) * surplus;

      // Credit constraint: consumption is cut before debt can exceed the limit.
      const tax = p.incomeTaxRate * income[i];
      const debtLimit = p.maxDebtYears * Math.max(income[i], this.costOfLiving);
      const spendable = wealth[i] + income[i] + ubi - tax + debtLimit;
      const consumption = Math.max(0, Math.min(desiredConsumption, spendable));

      wealth[i] += income[i] - tax - consumption + ubi;

      if (-wealth[i] > debtLimit) {
        // Bankruptcy: the limit shrank (income loss); debts are cleared.
        wealth[i] = 0;
      }

      age[i] += 1;
    }

    if (wealthTaxPool > 0) {
      const rebate = wealthTaxPool / n;
      for (let i = 0; i < n; i++) {
        wealth[i] += rebate;
      }
    }

    if (p.crashProbability > 0 && this.rng() < p.crashProbability) {
      const loss = p.crashSeverity * (0.5 + this.rng() * 0.5);
      for (let i = 0; i < n; i++) {
        if (wealth[i] > 0) {
          const idiosyncratic = 0.5 + this.rng();
          wealth[i] *= 1 - Math.min(1, loss * idiosyncratic);
        }
      }
    }

    const rhoIG = CORRELATIONS.intergenerational;
    const rho2IG = Math.sqrt(1 - rhoIG * rhoIG);
    for (let i = 0; i < n; i++) {
      if (this.rng() < deathProbability(age[i])) {
        // The respawned adult is the heir: dynastic, single-child inheritance.
        const estate = wealth[i] > 0 ? wealth[i] * p.inheritanceRate : wealth[i];
        const zParent =
          Math.log(Math.max(Number.MIN_VALUE, incomeFactor[i] * this.incomeNorm)) / this.sigmaI ||
          0;
        const zChild = rhoIG * zParent + rho2IG * this.gauss();
        incomeFactor[i] = Math.exp(this.sigmaI * zChild) / this.incomeNorm;
        wealth[i] = estate;
        age[i] = DEMOGRAPHICS.entryAgeMin + this.rng() * DEMOGRAPHICS.entryAgeSpan;
      }
    }

    this.currentStats = this.computeStats();
  }

  sortedWealth(): Float64Array {
    this.sorted.set(this.wealth);
    this.sorted.sort();
    return this.sorted;
  }

  computeStats(): YearStats {
    const n = this.n;
    const s = this.sortedWealth();
    let total = 0;
    for (let i = 0; i < n; i++) {
      total += s[i];
    }
    const mean = total / n;
    const mid = n >> 1;
    const median = n % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;

    // The Lorenz-curve Gini is only defined over non-negative balances: it
    // divides by the total, so a population carrying debt gets an inflated
    // score that silently clamps to 0. Measure inequality on a population
    // shifted up to be non-negative, which reads the single worst-off agent as
    // holding zero net worth — the usual treatment for net-worth distributions.
    // The shift is zero whenever nobody is in debt, leaving the textbook
    // formula untouched for every population that never borrows.
    const shift = s[0] < 0 ? s[0] : 0;
    let gini = 0;
    const shiftedTotal = total - shift * n;
    if (shiftedTotal > 0) {
      let weighted = 0;
      for (let i = 0; i < n; i++) {
        weighted += (i + 1) * (s[i] - shift);
      }
      const g = (2 * weighted) / (n * shiftedTotal) - (n + 1) / n;
      gini = Number.isFinite(g) ? Math.min(1, Math.max(0, g)) : 0;
    }

    const top1 = top1Count(n);
    const bottom50Count = Math.max(1, Math.floor(0.5 * n));
    let top1Sum = 0;
    let bottom50Sum = 0;
    for (let i = 0; i < n; i++) {
      if (i >= n - top1) top1Sum += s[i];
      if (i < bottom50Count) bottom50Sum += s[i];
    }

    return {
      year: this.year,
      total,
      mean,
      median,
      gini,
      top1Avg: top1Sum / top1,
      bottom50Avg: bottom50Sum / bottom50Count,
      top1Share: total > 0 ? top1Sum / total : Number.NaN,
      bottom50Share: total > 0 ? bottom50Sum / total : Number.NaN,
      meanIncome: this.meanIncome,
    };
  }
}

export interface HistogramBin {
  min: number;
  max: number;
  count: number;
}

export function buildHistogram(
  sorted: Float64Array,
  binCount = 120,
): { bins: HistogramBin[]; negatives: number } {
  let negatives = 0;
  let minLog = Infinity;
  let maxLog = -Infinity;
  for (let i = 0; i < sorted.length; i++) {
    const v = sorted[i];
    if (v > 0) {
      const l = Math.log10(v);
      if (l < minLog) minLog = l;
      if (l > maxLog) maxLog = l;
    } else {
      negatives += 1;
    }
  }
  if (!Number.isFinite(minLog)) {
    return { bins: [], negatives };
  }
  const span = maxLog - minLog;
  const width = span <= 0 ? 1 : span / binCount;
  const bins: HistogramBin[] = [];
  for (let b = 0; b < binCount; b++) {
    const lo = minLog + b * width;
    bins.push({ min: Math.pow(10, lo), max: Math.pow(10, lo + width), count: 0 });
  }
  for (let i = 0; i < sorted.length; i++) {
    const v = sorted[i];
    if (v <= 0) continue;
    const l = Math.log10(v);
    let idx = Math.floor((l - minLog) / width);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx].count += 1;
  }
  return { bins, negatives };
}

export function sortWealth(wealth: Float64Array): Float64Array {
  const sorted = wealth.slice();
  sorted.sort();
  return sorted;
}

export function top1Count(population: number): number {
  return Math.max(1, Math.round(0.01 * population));
}

export function top1Bins(bins: readonly HistogramBin[], population: number): boolean[] {
  const flags = bins.map(() => false);
  let remaining = top1Count(population);
  for (let i = bins.length - 1; i >= 0 && remaining > 0; i--) {
    if (bins[i].count === 0) continue;
    flags[i] = true;
    remaining -= bins[i].count;
  }
  return flags;
}

export function percentile(sorted: Float64Array, pct: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const rank = Math.ceil(pct * n);
  return sorted[Math.min(n - 1, Math.max(0, rank - 1))];
}
