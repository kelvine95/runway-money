import type { Advance, Dataset, Earning, Obligation, Txn, Worker } from "./types";
import { addDays, dateRange, diffDays, nextDueDate } from "./dates";
import { median, quantileOf, sum } from "./stats";

export interface ScheduledBill {
  obligation: Obligation;
  dueDate: string;
  daysUntil: number;
}

/**
 * Canonical per-worker model. The synthetic feed's running balances are
 * per-stream and internally inconsistent, so we rebuild one ledger from
 * transaction deltas anchored at the first observed balance.
 */
export interface WorkerModel {
  worker: Worker;
  asOf: string;
  earnings: Earning[];
  txns: Txn[];
  obligations: Obligation[];
  advances: Advance[];

  /** Every calendar day from first observation to asOf-1 with that day's net earnings (0 on off days). */
  dailyIncome: { date: string; income: number }[];
  /** Weekly net earnings (Mon-start weeks, full weeks only). */
  weeklyIncome: number[];
  /** Rebuilt end-of-day balance series. */
  balanceSeries: { date: string; balance: number }[];
  currentBalance: number;

  /** Average daily spend on variable essentials (groceries, transit, ...) excluding scheduled bills, trailing 56 days. */
  dailyEssentialSpend: number;
  /** Scheduled obligations expressed per day (monthly total / 30). */
  dailyObligationAccrual: number;
  monthlyObligations: number;

  /** Bills due in the next 35 days from asOf. */
  upcomingBills: ScheduledBill[];

  medianNetPerShift: number;
  workDaysPerWeek: number;
  /** Trailing daily net income pool (last 56 days, incl. zero days) for sampling. */
  incomePool: number[];
}

export function buildWorkerModel(ds: Dataset, workerId: string): WorkerModel {
  const worker = ds.workerById.get(workerId)!;
  const earnings = ds.earningsByWorker.get(workerId) ?? [];
  const txns = ds.txnsByWorker.get(workerId) ?? [];
  const obligations = ds.obligationsByWorker.get(workerId) ?? [];
  const advances = ds.advancesByWorker.get(workerId) ?? [];
  const asOf = ds.asOfDate;

  const firstDate =
    txns.length > 0 ? txns[0].txn_ts.slice(0, 10) : addDays(asOf, -90);
  const lastObserved = addDays(asOf, -1);

  // Daily income series over the full observation window.
  const incomeByDate = new Map<string, number>();
  for (const e of earnings) {
    incomeByDate.set(e.work_date, (incomeByDate.get(e.work_date) ?? 0) + e.net_pay_cad);
  }
  const days = dateRange(firstDate, lastObserved);
  const dailyIncome = days.map((date) => ({ date, income: incomeByDate.get(date) ?? 0 }));

  // Full Monday-start weeks.
  const weeklyIncome: number[] = [];
  {
    let acc = 0;
    let count = 0;
    for (const d of dailyIncome) {
      acc += d.income;
      count++;
      const dow = new Date(Date.parse(`${d.date}T00:00:00Z`)).getUTCDay();
      if (dow === 0) {
        // Sunday closes the week
        if (count === 7) weeklyIncome.push(acc);
        acc = 0;
        count = 0;
      }
    }
  }

  // Rebuild balance ledger anchored at first observed running balance.
  const balanceByDate = new Map<string, number>();
  let balance = 0;
  if (txns.length > 0) {
    const first = txns[0];
    balance =
      first.running_balance_cad +
      (first.direction === "credit" ? -first.amount_cad : first.amount_cad);
  }
  for (const t of txns) {
    balance += t.direction === "credit" ? t.amount_cad : -t.amount_cad;
    balanceByDate.set(t.txn_ts.slice(0, 10), balance);
  }
  const balanceSeries: { date: string; balance: number }[] = [];
  let lastBal = 0;
  for (const date of days) {
    if (balanceByDate.has(date)) lastBal = balanceByDate.get(date)!;
    balanceSeries.push({ date, balance: lastBal });
  }
  const currentBalance = lastBal;

  // Variable essential spend (essential debits not tied to a scheduled obligation).
  const trailingStart = addDays(asOf, -56);
  const variableEssentialTotal = sum(
    txns
      .filter(
        (t) =>
          t.direction === "debit" &&
          t.is_essential === 1 &&
          !String(t.notes).includes("obligation_id") &&
          t.txn_ts.slice(0, 10) >= trailingStart,
      )
      .map((t) => t.amount_cad),
  );
  const trailingDays = Math.min(56, Math.max(1, diffDays(asOf, firstDate)));
  const dailyEssentialSpend = variableEssentialTotal / trailingDays;

  const monthlyObligations = sum(obligations.map((o) => o.amount_cad));
  const dailyObligationAccrual = monthlyObligations / 30;

  const upcomingBills: ScheduledBill[] = obligations
    .map((o) => {
      const dueDate = nextDueDate(asOf, o.due_day_of_month);
      return { obligation: o, dueDate, daysUntil: diffDays(dueDate, asOf) };
    })
    .filter((b) => b.daysUntil <= 35)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const shiftNets = earnings.map((e) => e.net_pay_cad);
  const medianNetPerShift = median(shiftNets);

  const workedDates = new Set(earnings.map((e) => e.work_date));
  const workDaysPerWeek = (workedDates.size / days.length) * 7;

  const incomePool = dailyIncome
    .filter((d) => d.date >= trailingStart)
    .map((d) => d.income);

  return {
    worker,
    asOf,
    earnings,
    txns,
    obligations,
    advances,
    dailyIncome,
    weeklyIncome,
    balanceSeries,
    currentBalance,
    dailyEssentialSpend,
    dailyObligationAccrual,
    monthlyObligations,
    upcomingBills,
    medianNetPerShift,
    workDaysPerWeek,
    incomePool,
  };
}

/** Conservative weekly income floor: 25th percentile of observed full weeks. */
export function weeklyFloor(model: WorkerModel): number {
  return quantileOf(model.weeklyIncome, 0.25);
}
