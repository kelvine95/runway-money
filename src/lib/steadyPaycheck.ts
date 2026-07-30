import type { WorkerModel } from "./engine";
import { weeklyFloor } from "./engine";
import { sum } from "./stats";

export interface SteadySimDay {
  date: string;
  actualIncome: number;
  paycheck: number;
  holdingBalance: number;
}

export interface SteadyPaycheckResult {
  weeklyFloor: number;
  dailyPaycheck: number;
  sim: SteadySimDay[];
  /** % of days the full steady paycheck could be paid out of the holding account. */
  reliability: number;
  endingBuffer: number;
  /** Advances that the holding buffer could have covered at request time. */
  avoidableAdvances: number;
  totalAdvances: number;
  avoidableFees: number;
  totalFees: number;
}

/**
 * The "pay yourself a salary" method, automated: every dollar earned lands in a
 * holding buffer; the worker is paid a fixed daily paycheck set at their income
 * floor (P25 of their own weeks / 7). We replay their actual history to show
 * how steady that paycheck would have been and which wage advances (and fees)
 * the buffer would have absorbed.
 */
export function simulateSteadyPaycheck(model: WorkerModel): SteadyPaycheckResult {
  const floor = weeklyFloor(model);
  const dailyPaycheck = floor / 7;

  const sim: SteadySimDay[] = [];
  let holding = 0;
  let fullDays = 0;
  for (const d of model.dailyIncome) {
    holding += d.income;
    const pay = Math.min(dailyPaycheck, holding);
    holding -= pay;
    if (pay >= dailyPaycheck - 0.01) fullDays++;
    sim.push({ date: d.date, actualIncome: d.income, paycheck: pay, holdingBalance: holding });
  }

  const holdingByDate = new Map(sim.map((s) => [s.date, s.holdingBalance]));
  let avoidableAdvances = 0;
  let avoidableFees = 0;
  for (const a of model.advances) {
    const onDate = holdingByDate.get(a.requested_at.slice(0, 10));
    if (onDate !== undefined && onDate >= a.amount_cad) {
      avoidableAdvances++;
      avoidableFees += a.fee_cad;
    }
  }

  return {
    weeklyFloor: floor,
    dailyPaycheck,
    sim,
    reliability: sim.length > 0 ? fullDays / sim.length : 0,
    endingBuffer: holding,
    avoidableAdvances,
    totalAdvances: model.advances.length,
    avoidableFees,
    totalFees: sum(model.advances.map((a) => a.fee_cad)),
  };
}
