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
  top10Avg: number;
  bottom50Avg: number;
  top1Share: number;
  top10Share: number;
  bottom50Share: number;
}

export interface SimulationSnapshot {
  year: number;
  stats: YearStats;
  wealth: Float64Array;
}

export const MAX_YEAR = 300;

export function simulate(
  params: WorldParams,
  seed: number,
  maxYear: number = MAX_YEAR,
): SimulationSnapshot[] {
  const world: WorldConfig = {
    populationSize: params.populationSize,
    incomeInequality: params.incomeInequality,
    initialWealth: params.initialWealth,
    initialInequality: params.initialInequality,
  };
  const sim = new Simulation(seed, world);
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

function careerFactor(age: number): number {
  return 0.6 + 0.9 * Math.exp(-((age - 45) * (age - 45)) / 512);
}

const RETIREMENT_AGE = 70;

function employmentFactor(age: number): number {
  return 1 / (1 + Math.exp((age - RETIREMENT_AGE) / 2));
}

function laborIncomeFactor(age: number): number {
  return careerFactor(age) * employmentFactor(age);
}

function deathProbability(age: number): number {
  if (age >= MAX_AGE) return 1;
  return Math.min(1, 0.02 * Math.exp((age - 75) / 7));
}

const MAX_AGE = 110;

const INTERGENERATION_CORRELATION = 0.5;

export interface WorldConfig {
  populationSize: number;
  incomeInequality: number;
  initialWealth: number;
  initialInequality: number;
}

export class Simulation {
  readonly n: number;
  readonly wealth: Float64Array;
  readonly incomeFactor: Float64Array;
  readonly age: Float32Array;
  readonly world: WorldConfig;
  year = 0;
  currentStats: YearStats;

  private readonly sorted: Float64Array;
  private readonly income: Float64Array;
  private readonly rng: () => number;
  private readonly gauss: () => number;
  private readonly sigmaI: number;
  private readonly incomeNorm: number;
  private readonly wealthNorm: number;
  private readonly rho = 0.7;

  private meanIncome: number | null = null;
  private costOfLiving: number | null = null;

  constructor(seed: number, world: WorldConfig) {
    this.world = world;
    this.n = Math.max(2, Math.floor(world.populationSize));
    this.wealth = new Float64Array(this.n);
    this.incomeFactor = new Float64Array(this.n);
    this.age = new Float32Array(this.n);
    this.sorted = new Float64Array(this.n);
    this.income = new Float64Array(this.n);
    this.rng = mulberry32(seed);
    this.gauss = makeGaussian(this.rng);
    this.sigmaI = world.incomeInequality;
    this.incomeNorm = Math.exp((this.sigmaI * this.sigmaI) / 2);
    this.wealthNorm = Math.exp((world.initialInequality * world.initialInequality) / 2);
    const rho = this.rho;
    const rho2 = Math.sqrt(1 - rho * rho);
    for (let i = 0; i < this.n; i++) {
      const zI = this.gauss();
      const zW = rho * zI + rho2 * this.gauss();
      this.incomeFactor[i] = Math.exp(this.sigmaI * zI) / this.incomeNorm;
      this.wealth[i] =
        (world.initialWealth * Math.exp(world.initialInequality * zW)) / this.wealthNorm;
      this.age[i] = 22 + this.rng() * 52;
    }
    this.currentStats = this.computeStats();
  }

  snapshot(): SimulationSnapshot {
    return {
      year: this.year,
      stats: this.currentStats,
      wealth: this.wealth.slice(),
    };
  }

  step(p: WorldParams): void {
    const { wealth, incomeFactor, income, age, n } = this;
    this.year += 1;

    if (this.meanIncome === null || this.costOfLiving === null) {
      this.meanIncome = p.meanIncome;
      this.costOfLiving = p.costOfLiving;
    }
    const growth = 1 + p.productivityGrowth;
    this.meanIncome *= growth;
    this.costOfLiving *= growth;

    for (let i = 0; i < n; i++) {
      const shock = Math.exp(p.incomeShock * this.gauss());
      income[i] = this.meanIncome * incomeFactor[i] * laborIncomeFactor(age[i]) * shock;
    }

    let taxPool = 0;
    for (let i = 0; i < n; i++) {
      taxPool += p.incomeTaxRate * income[i];
    }
    const ubi = taxPool / n;

    let wealthTaxPool = 0;
    for (let i = 0; i < n; i++) {
      const ref = Math.max(1, this.meanIncome);
      const effReturn = p.returnRate * (1 + p.returnScale * Math.tanh(wealth[i] / ref));
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
      const spendable = wealth[i] + income[i] + ubi - tax - debtLimit;
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

    const rhoIG = INTERGENERATION_CORRELATION;
    const rho2IG = Math.sqrt(1 - rhoIG * rhoIG);
    for (let i = 0; i < n; i++) {
      if (this.rng() < deathProbability(age[i])) {
        // The respawned adult is the heir: dynastic, single-child inheritance.
        const estate = wealth[i] * p.inheritanceRate;
        const zParent =
          (Math.log(Math.max(Number.MIN_VALUE, incomeFactor[i] * this.incomeNorm)) /
            this.sigmaI) || 0;
        const zChild = rhoIG * zParent + rho2IG * this.gauss();
        incomeFactor[i] = Math.exp(this.sigmaI * zChild) / this.incomeNorm;
        wealth[i] = estate;
        age[i] = 22 + this.rng() * 8;
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

    let gini = 0;
    if (n > 0) {
      let weighted = 0;
      for (let i = 0; i < n; i++) {
        weighted += (i + 1) * s[i];
      }
      const g = (2 * weighted) / (n * total) - (n + 1) / n;
      gini = Number.isFinite(g) ? Math.min(1, Math.max(0, g)) : 0;
    }

    const top1Count = Math.max(1, Math.round(0.01 * n));
    const top10Count = Math.max(1, Math.round(0.1 * n));
    const bottom50Count = Math.max(1, Math.floor(0.5 * n));
    let top1Sum = 0;
    let top10Sum = 0;
    let bottom50Sum = 0;
    for (let i = 0; i < n; i++) {
      if (i >= n - top1Count) top1Sum += s[i];
      if (i >= n - top10Count) top10Sum += s[i];
      if (i < bottom50Count) bottom50Sum += s[i];
    }

    return {
      year: this.year,
      total,
      mean,
      median,
      gini,
      top1Avg: top1Sum / top1Count,
      top10Avg: top10Sum / top10Count,
      bottom50Avg: bottom50Sum / bottom50Count,
      top1Share: total !== 0 ? top1Sum / total : 0,
      top10Share: total !== 0 ? top10Sum / total : 0,
      bottom50Share: total !== 0 ? bottom50Sum / total : 0,
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

export function percentile(sorted: Float64Array, pct: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  return sorted[Math.min(n - 1, Math.floor(pct * n))];
}
