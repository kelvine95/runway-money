import type { Dataset } from "./types";
import type { WorkerModel } from "./engine";
import { diffDays, nextDueDate } from "./dates";
import { median, sum } from "./stats";

export interface AdvanceDetail {
  advance_id: string;
  requestedDate: string;
  amount: number;
  fee: number;
  status: string;
  reason: string;
  daysOutstanding: number;
  /** Fee expressed as an annualized rate, payday-loan style. */
  effectiveApr: number;
  /** Days between the request and the worker's next rent due date. */
  daysBeforeRent: number | null;
}

export interface AdvanceAudit {
  details: AdvanceDetail[];
  count: number;
  totalBorrowed: number;
  totalFees: number;
  medianApr: number;
  /** Fees projected over 12 months at the observed pace. */
  annualizedFees: number;
  /** Share of advances requested within 7 days before rent is due. */
  rentCrunchShare: number;
  reasons: { reason: string; count: number; fees: number }[];
}

export function auditAdvances(model: WorkerModel): AdvanceAudit {
  const rent = model.obligations.find((o) => o.category === "housing");

  const details: AdvanceDetail[] = model.advances
    .map((a) => {
      const requestedDate = a.requested_at.slice(0, 10);
      const repaidDate = a.repaid_at ? a.repaid_at.slice(0, 10) : model.asOf;
      const daysOutstanding = Math.max(1, diffDays(repaidDate, requestedDate));
      const effectiveApr =
        a.amount_cad > 0 ? (a.fee_cad / a.amount_cad) * (365 / daysOutstanding) : 0;
      let daysBeforeRent: number | null = null;
      if (rent) {
        const due = nextDueDate(requestedDate, rent.due_day_of_month);
        daysBeforeRent = diffDays(due, requestedDate);
      }
      return {
        advance_id: a.advance_id,
        requestedDate,
        amount: a.amount_cad,
        fee: a.fee_cad,
        status: a.status,
        reason: a.reason_code,
        daysOutstanding,
        effectiveApr,
        daysBeforeRent,
      };
    })
    .sort((a, b) => b.requestedDate.localeCompare(a.requestedDate));

  const totalFees = sum(details.map((d) => d.fee));
  const spanDays =
    model.dailyIncome.length > 0 ? model.dailyIncome.length : 90;

  const reasonMap = new Map<string, { count: number; fees: number }>();
  for (const d of details) {
    const r = reasonMap.get(d.reason) ?? { count: 0, fees: 0 };
    r.count++;
    r.fees += d.fee;
    reasonMap.set(d.reason, r);
  }

  const feePaying = details.filter((d) => d.fee > 0);

  return {
    details,
    count: details.length,
    totalBorrowed: sum(details.map((d) => d.amount)),
    totalFees,
    medianApr: feePaying.length > 0 ? median(feePaying.map((d) => d.effectiveApr)) : 0,
    annualizedFees: (totalFees / spanDays) * 365,
    rentCrunchShare:
      details.length > 0
        ? details.filter((d) => d.daysBeforeRent !== null && d.daysBeforeRent <= 7).length /
          details.length
        : 0,
    reasons: [...reasonMap]
      .map(([reason, v]) => ({ reason, ...v }))
      .sort((a, b) => b.count - a.count),
  };
}

export interface CohortStats {
  workersWithAdvances: number;
  totalWorkers: number;
  totalAdvances: number;
  totalFees: number;
}

export function cohortAdvanceStats(ds: Dataset): CohortStats {
  let totalAdvances = 0;
  let totalFees = 0;
  for (const list of ds.advancesByWorker.values()) {
    totalAdvances += list.length;
    totalFees += sum(list.map((a) => a.fee_cad));
  }
  return {
    workersWithAdvances: ds.advancesByWorker.size,
    totalWorkers: ds.workers.length,
    totalAdvances,
    totalFees,
  };
}
