import Papa from "papaparse";
import type {
  Advance,
  Dataset,
  Earning,
  Obligation,
  Txn,
  WeeklySummary,
  Worker,
} from "./types";
import { addDays } from "./dates";
import { groupBy } from "./stats";

async function parseCsv<T>(path: string): Promise<T[]> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  const text = await res.text();
  const parsed = Papa.parse<T>(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return parsed.data;
}

const base = import.meta.env.BASE_URL;

export async function loadDataset(): Promise<Dataset> {
  const [workers, earnings, txns, obligations, advances, weekly] = await Promise.all([
    parseCsv<Worker>(`${base}data/workers.csv`),
    parseCsv<Earning>(`${base}data/daily_earnings.csv`),
    parseCsv<Txn>(`${base}data/transactions.csv`),
    parseCsv<Obligation>(`${base}data/recurring_obligations.csv`),
    parseCsv<Advance>(`${base}data/earned_wage_advances.csv`),
    parseCsv<WeeklySummary>(`${base}data/weekly_cashflow_summary.csv`),
  ]);

  // PapaParse dynamicTyping leaves empty cells as null; normalize notes/repaid_at.
  for (const t of txns) t.notes = t.notes ?? "";
  for (const a of advances) a.repaid_at = a.repaid_at ?? "";

  const earningsByWorker = groupBy(earnings, (e) => e.worker_id);
  const txnsByWorker = groupBy(txns, (t) => t.worker_id);
  for (const list of earningsByWorker.values())
    list.sort((a, b) => a.work_date.localeCompare(b.work_date));
  for (const list of txnsByWorker.values())
    list.sort((a, b) => a.txn_ts.localeCompare(b.txn_ts));

  let maxTs = "";
  for (const t of txns) if (t.txn_ts > maxTs) maxTs = t.txn_ts;

  return {
    workers,
    workerById: new Map(workers.map((w) => [w.worker_id, w])),
    earningsByWorker,
    txnsByWorker,
    obligationsByWorker: groupBy(obligations, (o) => o.worker_id),
    advancesByWorker: groupBy(advances, (a) => a.worker_id),
    weeklyByWorker: groupBy(weekly, (w) => w.worker_id),
    asOfDate: addDays(maxTs.slice(0, 10), 1),
  };
}
