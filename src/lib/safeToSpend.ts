import type { WorkerModel } from "./engine";
import { weeklyFloor } from "./engine";
import { sum } from "./stats";

export interface SafeToSpend {
  horizonDays: number;
  balance: number;
  conservativeIncome: number;
  billsDue: number;
  essentials: number;
  bufferFloor: number;
  bufferDaysTarget: number;
  /** Total flex over the horizon (can be negative = shortfall). */
  flexTotal: number;
  /** What you can safely spend today. */
  safeToday: number;
  shortfall: number;
  shiftsToCover: number;
}

/**
 * "Safe to spend today" = what's left after reserving upcoming bills,
 * essential spend, and a buffer floor — assuming a BAD income stretch
 * (25th percentile of the worker's own weeks), not an average one.
 */
export function computeSafeToSpend(model: WorkerModel, horizonDays = 14): SafeToSpend {
  const billsDue = sum(
    model.upcomingBills
      .filter((b) => b.daysUntil < horizonDays)
      .map((b) => b.obligation.amount_cad),
  );
  const essentials = model.dailyEssentialSpend * horizonDays;
  const conservativeIncome = (weeklyFloor(model) / 7) * horizonDays;

  const bufferDaysTarget = 7;
  const costPerDay = model.dailyEssentialSpend + model.dailyObligationAccrual;
  const bufferFloor = bufferDaysTarget * costPerDay;

  const flexTotal =
    model.currentBalance + conservativeIncome - billsDue - essentials - bufferFloor;
  const safeToday = Math.max(0, flexTotal) / horizonDays;
  const shortfall = Math.max(0, -flexTotal);
  const shiftsToCover =
    model.medianNetPerShift > 0 ? shortfall / model.medianNetPerShift : 0;

  return {
    horizonDays,
    balance: model.currentBalance,
    conservativeIncome,
    billsDue,
    essentials,
    bufferFloor,
    bufferDaysTarget,
    flexTotal,
    safeToday,
    shortfall,
    shiftsToCover,
  };
}

/** How many days the current balance covers with zero income. */
export function runwayDays(model: WorkerModel): number {
  const costPerDay = model.dailyEssentialSpend + model.dailyObligationAccrual;
  if (costPerDay <= 0) return 99;
  return model.currentBalance / costPerDay;
}
