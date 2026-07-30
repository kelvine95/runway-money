import type { ScheduledBill, WorkerModel } from "./engine";
import { addDays } from "./dates";
import { hashString, mulberry32, quantile } from "./stats";

export interface ForecastDay {
  date: string;
  p10: number;
  p50: number;
  p90: number;
  bills: ScheduledBill[];
}

export interface BillCoverage {
  bill: ScheduledBill;
  /** Fraction of simulations where the bill is paid without going negative. */
  coverage: number;
  /** Median shortfall on the due date across failing trials (0 if fully covered). */
  medianShortfall: number;
  shiftsNeeded: number;
}

export interface RunwayForecast {
  days: ForecastDay[];
  billCoverage: BillCoverage[];
  /** First day the median path goes negative, or null if it never does. */
  medianBreakDay: string | null;
  probNegative30: number;
}

/**
 * Monte Carlo cashflow forecast: sample daily income from the worker's own
 * trailing 56-day distribution (off days included), subtract average daily
 * essentials, and pay scheduled bills on their due dates.
 */
export function forecastRunway(model: WorkerModel, horizonDays = 30, trials = 400): RunwayForecast {
  const rng = mulberry32(hashString(model.worker.worker_id));
  const pool = model.incomePool.length > 0 ? model.incomePool : [0];

  const billsByDay = new Map<number, ScheduledBill[]>();
  for (const b of model.upcomingBills) {
    if (b.daysUntil < horizonDays) {
      const arr = billsByDay.get(b.daysUntil) ?? [];
      arr.push(b);
      billsByDay.set(b.daysUntil, arr);
    }
  }

  // balances[d][trial] = end-of-day balance
  const balances: number[][] = Array.from({ length: horizonDays }, () => new Array(trials));
  // Balance available right after paying each bill, per trial.
  const billOutcomes = new Map<string, number[]>();
  for (const dayBills of billsByDay.values())
    for (const b of dayBills) billOutcomes.set(b.obligation.obligation_id, new Array(trials));

  for (let t = 0; t < trials; t++) {
    let bal = model.currentBalance;
    for (let d = 0; d < horizonDays; d++) {
      bal += pool[Math.floor(rng() * pool.length)];
      bal -= model.dailyEssentialSpend;
      for (const b of billsByDay.get(d) ?? []) {
        bal -= b.obligation.amount_cad;
        billOutcomes.get(b.obligation.obligation_id)![t] = bal;
      }
      balances[d][t] = bal;
    }
  }

  const days: ForecastDay[] = balances.map((dayBalances, d) => {
    const sorted = [...dayBalances].sort((a, b) => a - b);
    return {
      date: addDays(model.asOf, d),
      p10: quantile(sorted, 0.1),
      p50: quantile(sorted, 0.5),
      p90: quantile(sorted, 0.9),
      bills: billsByDay.get(d) ?? [],
    };
  });

  const billCoverage: BillCoverage[] = [];
  for (const dayBills of billsByDay.values()) {
    for (const b of dayBills) {
      const outcomes = billOutcomes.get(b.obligation.obligation_id)!;
      const failing = outcomes.filter((v) => v < 0);
      const coverage = 1 - failing.length / trials;
      const medianShortfall =
        failing.length > 0 ? -quantile([...failing].sort((x, y) => x - y), 0.5) : 0;
      billCoverage.push({
        bill: b,
        coverage,
        medianShortfall,
        shiftsNeeded:
          model.medianNetPerShift > 0 ? medianShortfall / model.medianNetPerShift : 0,
      });
    }
  }
  billCoverage.sort((a, b) => a.bill.daysUntil - b.bill.daysUntil);

  const firstNegative = days.find((d) => d.p50 < 0);
  const lastDay = balances[horizonDays - 1];
  const probNegative30 = lastDay.filter((v) => v < 0).length / trials;

  return {
    days,
    billCoverage,
    medianBreakDay: firstNegative ? firstNegative.date : null,
    probNegative30,
  };
}
