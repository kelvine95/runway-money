import { useEffect, useMemo, useState } from "react";
import type { Dataset } from "./lib/types";
import { loadDataset } from "./lib/loadData";
import { buildWorkerModel } from "./lib/engine";
import { formatDateLong } from "./lib/dates";
import { pct } from "./lib/format";
import TodayView from "./views/TodayView";
import PaycheckView from "./views/PaycheckView";
import RunwayView from "./views/RunwayView";
import ShiftsView from "./views/ShiftsView";
import AdvancesView from "./views/AdvancesView";

const TABS = [
  { id: "today", title: "Today", desc: "Safe to spend right now" },
  { id: "paycheck", title: "Steady Paycheck", desc: "Your volatility, smoothed" },
  { id: "runway", title: "Bill Runway", desc: "30-day forecast, in shifts" },
  { id: "shifts", title: "Shift ROI", desc: "Which work actually pays" },
  { id: "advances", title: "Advance Audit", desc: "What borrowing costs you" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function App() {
  const [ds, setDs] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workerId, setWorkerId] = useState<string>("");
  const [tab, setTab] = useState<TabId>("today");

  useEffect(() => {
    loadDataset()
      .then((data) => {
        setDs(data);
        // Default to the busiest advance user — the persona this tool exists for.
        let best = data.workers[0]?.worker_id ?? "";
        let most = -1;
        for (const w of data.workers) {
          const n = data.advancesByWorker.get(w.worker_id)?.length ?? 0;
          if (n > most) {
            most = n;
            best = w.worker_id;
          }
        }
        setWorkerId(best);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const model = useMemo(
    () => (ds && workerId ? buildWorkerModel(ds, workerId) : null),
    [ds, workerId],
  );

  if (error) {
    return (
      <div className="loading">
        <div>Failed to load data: {error}</div>
      </div>
    );
  }

  if (!ds || !model) {
    return (
      <div className="loading">
        <div className="pulse">Crunching 31,726 transactions for 220 workers…</div>
      </div>
    );
  }

  const w = model.worker;

  const shuffle = () => {
    const idx = Math.floor(Math.random() * ds.workers.length);
    setWorkerId(ds.workers[idx].worker_id);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">R</div>
          <div>
            <h1>Runway</h1>
            <p>money copilot for daily earners</p>
          </div>
        </div>

        <div className="picker">
          <label>Worker</label>
          <div className="picker-row">
            <select value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
              {ds.workers.map((wk) => (
                <option key={wk.worker_id} value={wk.worker_id}>
                  {wk.worker_id} · {wk.occupation} · {wk.city}
                </option>
              ))}
            </select>
            <button onClick={shuffle} title="Random worker">
              ⤳
            </button>
          </div>
        </div>

        <div className="worker-meta">
          <span className="chip">{w.pay_type} pay</span>
          <span className={`chip ${w.income_volatility >= 0.45 ? "hot" : ""}`}>
            volatility {pct(w.income_volatility)}
          </span>
          <span className={`chip ${w.rent_burden_band === "severe" || w.rent_burden_band === "high" ? "hot" : ""}`}>
            rent burden: {w.rent_burden_band}
          </span>
          {w.dependents > 0 && <span className="chip">{w.dependents} dependents</span>}
          {w.has_side_gig === 1 && <span className="chip">side gig</span>}
          {w.has_bank_account === 0 && <span className="chip hot">no bank account</span>}
        </div>

        <nav className="nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
            >
              <span className="nav-title">{t.title}</span>
              <span className="nav-desc">{t.desc}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          Synthetic dataset · 220 Alberta workers · Apr–Jul 2026.
          <br />
          Simulated “today”: {formatDateLong(ds.asOfDate)}.
        </div>
      </aside>

      <main className="main">
        {tab === "today" && <TodayView model={model} />}
        {tab === "paycheck" && <PaycheckView model={model} />}
        {tab === "runway" && <RunwayView model={model} />}
        {tab === "shifts" && <ShiftsView model={model} />}
        {tab === "advances" && <AdvancesView model={model} ds={ds} />}
      </main>
    </div>
  );
}
