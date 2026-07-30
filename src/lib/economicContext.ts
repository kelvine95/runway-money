import type { WorkerModel } from "./engine";
import { mean, sum } from "./stats";

export interface MacroMetric {
  label: string;
  value: number;
  unit: "percent" | "rate";
  note: string;
  source: string;
  sourceUrl: string;
}

export const MACRO_AS_OF = "July 2026";

export const CANADA_MACRO: MacroMetric[] = [
  {
    label: "Canada CPI",
    value: 2.8,
    unit: "percent",
    note: "12-month change, June 2026",
    source: "Statistics Canada",
    sourceUrl: "https://www150.statcan.gc.ca/n1/daily-quotidien/260720/dq260720a-eng.htm",
  },
  {
    label: "Alberta CPI",
    value: 3.4,
    unit: "percent",
    note: "12-month change, June 2026",
    source: "Statistics Canada",
    sourceUrl: "https://www150.statcan.gc.ca/n1/daily-quotidien/260720/dq260720a-eng.htm",
  },
  {
    label: "Alberta unemployment",
    value: 7.0,
    unit: "percent",
    note: "seasonally adjusted, June 2026",
    source: "Statistics Canada",
    sourceUrl: "https://www150.statcan.gc.ca/n1/daily-quotidien/260710/dq260710a-eng.htm",
  },
  {
    label: "Bank of Canada rate",
    value: 2.25,
    unit: "rate",
    note: "overnight target, July 15, 2026",
    source: "Bank of Canada",
    sourceUrl: "https://www.bankofcanada.ca/2026/07/fad-press-release-2026-07-15/",
  },
];

export const US_MACRO: MacroMetric[] = [
  {
    label: "US CPI",
    value: 3.5,
    unit: "percent",
    note: "12-month change, June 2026",
    source: "US Bureau of Labor Statistics",
    sourceUrl: "https://www.bls.gov/news.release/archives/cpi_07142026.htm",
  },
  {
    label: "US food CPI",
    value: 3.0,
    unit: "percent",
    note: "12-month change, June 2026",
    source: "US Bureau of Labor Statistics",
    sourceUrl: "https://www.bls.gov/cpi/",
  },
  {
    label: "US shelter CPI",
    value: 3.3,
    unit: "percent",
    note: "12-month change, June 2026",
    source: "US Bureau of Labor Statistics",
    sourceUrl: "https://www.bls.gov/cpi/",
  },
  {
    label: "Federal funds range",
    value: 3.625,
    unit: "rate",
    note: "midpoint of 3.50–3.75%, July 29, 2026",
    source: "US Federal Reserve",
    sourceUrl: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260729a.htm",
  },
];

export const CANADA_CATEGORY_INFLATION: Record<string, number> = {
  housing: 1.5,
  rent: 1.5,
  groceries: 3.9,
  food_out: 3.5,
  transit: 6.7,
  utilities: 1.5,
  phone: -0.2,
  childcare: 2.8,
  personal_care: 2.5,
  health: 2.5,
  entertainment: 3.8,
  misc: 2.8,
  debt_payment: 2.25,
};

export const LIVING_WAGE_BY_CITY: Record<string, number> = {
  Airdrie: 29.0,
  Calgary: 26.5,
  Edmonton: 22.3,
  Lethbridge: 22.3,
  "Medicine Hat": 18.15,
  "Red Deer": 20.65,
  Okotoks: 23.4,
  Cochrane: 26.5,
};

export const LIVING_WAGE_SOURCE =
  "https://www.livingwagealberta.ca/what-is-a-living-wage";

export interface PersonalPressure {
  personalInflation: number;
  observedHourlyNet: number;
  livingWage: number;
  livingWageGap: number;
  monthlyInflationDrag: number;
  dragInShifts: number;
  categoryPressure: { category: string; share: number; inflation: number }[];
}

export function computePersonalPressure(model: WorkerModel): PersonalPressure {
  const essentialDebits = model.txns.filter(
    (txn) => txn.direction === "debit" && txn.is_essential === 1,
  );
  const totalEssential = sum(essentialDebits.map((txn) => txn.amount_cad));
  const categoryTotals = new Map<string, number>();

  for (const txn of essentialDebits) {
    categoryTotals.set(
      txn.category,
      (categoryTotals.get(txn.category) ?? 0) + txn.amount_cad,
    );
  }

  const categoryPressure = [...categoryTotals]
    .map(([category, amount]) => ({
      category,
      share: totalEssential > 0 ? amount / totalEssential : 0,
      inflation: CANADA_CATEGORY_INFLATION[category] ?? 2.8,
    }))
    .sort((a, b) => b.share - a.share);

  const personalInflation = sum(
    categoryPressure.map((category) => category.share * category.inflation),
  );
  const observedHourlyNet = mean(
    model.earnings.map((earning) => earning.net_pay_cad / Math.max(1, earning.hours_worked)),
  );
  const livingWage =
    LIVING_WAGE_BY_CITY[model.worker.city] ??
    (model.worker.city.includes("Calgary") ? 26.5 : 22.3);
  const monthlyEssentialSpend =
    model.dailyEssentialSpend * 30 + model.monthlyObligations;
  const monthlyInflationDrag = monthlyEssentialSpend * (personalInflation / 100);

  return {
    personalInflation,
    observedHourlyNet,
    livingWage,
    livingWageGap: observedHourlyNet - livingWage,
    monthlyInflationDrag,
    dragInShifts:
      model.medianNetPerShift > 0 ? monthlyInflationDrag / model.medianNetPerShift : 0,
    categoryPressure,
  };
}
