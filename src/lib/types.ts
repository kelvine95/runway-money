export interface Worker {
  worker_id: string;
  city: string;
  province: string;
  occupation: string;
  pay_type: "daily" | "gig" | "hourly";
  typical_daily_net_cad: number;
  income_volatility: number;
  tip_share: number;
  household_size: number;
  dependents: number;
  has_bank_account: number;
  uses_prepaid_card: number;
  primary_employer_id: string;
  tenure_months: number;
  has_side_gig: number;
  commute_mode: string;
  rent_burden_band: "low" | "moderate" | "high" | "severe";
}

export interface Earning {
  earnings_id: string;
  worker_id: string;
  work_date: string; // YYYY-MM-DD
  employer_id: string;
  shift_type: string;
  hours_worked: number;
  gross_pay_cad: number;
  tips_cad: number;
  deductions_cad: number;
  net_pay_cad: number;
  paid_same_day: number;
  pay_method: string;
}

export interface Txn {
  txn_id: string;
  worker_id: string;
  txn_ts: string; // ISO timestamp
  direction: "credit" | "debit";
  amount_cad: number;
  category: string;
  merchant_type: string;
  channel: string;
  is_essential: number;
  running_balance_cad: number;
  notes: string;
}

export interface Obligation {
  obligation_id: string;
  worker_id: string;
  name: string;
  category: string;
  amount_cad: number;
  frequency: string;
  due_day_of_month: number;
  autopay: number;
  essential: number;
}

export interface Advance {
  advance_id: string;
  worker_id: string;
  requested_at: string; // ISO timestamp
  amount_cad: number;
  fee_cad: number;
  status: "repaid" | "outstanding";
  repaid_at: string;
  repayment_source: string;
  reason_code: string;
}

export interface WeeklySummary {
  worker_id: string;
  week_start: string;
  income_cad: number;
  expense_cad: number;
  essential_expense_cad: number;
  net_cashflow_cad: number;
  advances_count: number;
  advances_amount_cad: number;
  advance_fees_cad: number;
  ending_balance_cad: number;
  buffer_days_estimate: number | null;
  negative_balance_flag: number;
}

export interface Dataset {
  workers: Worker[];
  workerById: Map<string, Worker>;
  earningsByWorker: Map<string, Earning[]>;
  txnsByWorker: Map<string, Txn[]>;
  obligationsByWorker: Map<string, Obligation[]>;
  advancesByWorker: Map<string, Advance[]>;
  weeklyByWorker: Map<string, WeeklySummary[]>;
  /** Day after the last observed transaction — the app's simulated "today". */
  asOfDate: string;
}
