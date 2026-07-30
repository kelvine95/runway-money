import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Dataset } from "../lib/types";
import type { WorkerModel } from "../lib/engine";
import { auditAdvances, cohortAdvanceStats } from "../lib/advances";
import { simulateSteadyPaycheck } from "../lib/steadyPaycheck";
import { money, money0, num, pct } from "../lib/format";
import { formatDate, formatDateLong } from "../lib/dates";
import { Badge, Callout, Card, StatCard } from "../components/ui";
import { tooltipStyle } from "./TodayView";

export default function AdvancesView({ model, ds }: { model: WorkerModel; ds: Dataset }) {
  const audit = useMemo(() => auditAdvances(model), [model]);
  const steady = useMemo(() => simulateSteadyPaycheck(model), [model]);
  const cohort = useMemo(() => cohortAdvanceStats(ds), [ds]);

  const timingBuckets = useMemo(() => {
    const buckets = [
      { label: "0–3d before rent", min: 0, max: 3, count: 0 },
      { label: "4–7d", min: 4, max: 7, count: 0 },
      { label: "8–14d", min: 8, max: 14, count: 0 },
      { label: "15–21d", min: 15, max: 21, count: 0 },
      { label: "22d+", min: 22, max: 99, count: 0 },
    ];
    for (const d of audit.details) {
      if (d.daysBeforeRent === null) continue;
      const b = buckets.find((x) => d.daysBeforeRent! >= x.min && d.daysBeforeRent! <= x.max);
      if (b) b.count++;
    }
    return buckets;
  }, [audit]);

  const reasonData = audit.reasons.map((r) => ({
    label: r.reason.replace(/_/g, " "),
    count: r.count,
    fees: Number(r.fees.toFixed(2)),
  }));

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Advance Audit</h2>
          <p className="subtitle">
            Cash-advance apps sell relief from volatility — and price it per crisis. This is what
            that pricing actually costs, in numbers lenders don't show.
          </p>
        </div>
        <span className="asof">as of {formatDateLong(model.asOf)}</span>
      </div>

      <div className="grid grid-stats">
        <StatCard
          label="Advances taken"
          value={String(audit.count)}
          sub={`${money(audit.totalBorrowed)} borrowed over ${model.dailyIncome.length} days`}
        />
        <StatCard
          label="Fees paid"
          value={money(audit.totalFees)}
          tone={audit.totalFees > 0 ? "bad" : "good"}
          sub={`≈ ${money0(audit.annualizedFees)}/year at this pace`}
        />
        <StatCard
          label="Median effective APR"
          value={audit.medianApr > 0 ? pct(audit.medianApr) : "—"}
          tone={audit.medianApr > 0.5 ? "bad" : "neutral"}
          sub="fee ÷ amount, annualized by days outstanding"
        />
        <StatCard
          label="Taken in rent week"
          value={pct(audit.rentCrunchShare)}
          tone={audit.rentCrunchShare > 0.4 ? "warn" : "neutral"}
          sub="advances requested within 7 days of rent being due"
        />
      </div>

      <div className="section">
        {audit.count === 0 ? (
          <Callout tone="good">
            No wage advances on record for this worker — the buffer methods on the other tabs are
            how it stays that way.
          </Callout>
        ) : (
          <Callout tone={steady.avoidableFees > 0 ? "warn" : "info"}>
            {steady.avoidableAdvances > 0 ? (
              <>
                <strong>{steady.avoidableAdvances} of {audit.count}</strong> of these advances
                happened on days when a steady-paycheck buffer would have held enough to cover
                them — meaning <strong>{money(steady.avoidableFees)}</strong> of the{" "}
                {money(audit.totalFees)} in fees bought liquidity this worker could have owned for
                free.
              </>
            ) : (
              <>
                These advances came during genuinely thin stretches — the fix is the income floor
                and buffer on the Steady Paycheck tab, not just cheaper borrowing.
              </>
            )}{" "}
            Fees may look small per advance, but {money(audit.totalFees)} over{" "}
            {Math.round(model.dailyIncome.length / 7)} weeks is{" "}
            <strong>{money0(audit.annualizedFees)}/year</strong> — about{" "}
            {num(audit.annualizedFees / Math.max(1, model.medianNetPerShift), 1)} full shifts
            worked just to pay for early access to your own wages.
          </Callout>
        )}
      </div>

      <div className="grid grid-2-even section">
        <Card
          title="When advances happen"
          sub="Distance between each advance request and the next rent due date. Borrowing clusters at the cliff."
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={timingBuckets} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
              <CartesianGrid stroke="#1e2833" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#5c6b78", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "#1e2833" }}
              />
              <YAxis
                tick={{ fill: "#5c6b78", fontSize: 11 }}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => [String(v), "advances"]}
              />
              <Bar dataKey="count" fill="#fbbf24" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Why advances happen" sub="Reasons given at request time, with the fees each reason cost.">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={reasonData}
              layout="vertical"
              margin={{ top: 6, right: 12, bottom: 0, left: 6 }}
            >
              <CartesianGrid stroke="#1e2833" strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#5c6b78", fontSize: 11 }}
                allowDecimals={false}
                tickLine={false}
                axisLine={{ stroke: "#1e2833" }}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fill: "#8fa0af", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={80}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, name) =>
                  name === "count" ? [String(v), "advances"] : [money(Number(v)), "fees"]
                }
              />
              <Bar dataKey="count" fill="#f87171" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {audit.details.length > 0 && (
        <div className="section">
          <Card title="Every advance, priced honestly" sub="Effective APR = fee ÷ amount, annualized over days outstanding.">
            <table>
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>Reason</th>
                  <th className="num">Amount</th>
                  <th className="num">Fee</th>
                  <th className="num">Days out</th>
                  <th className="num">Effective APR</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {audit.details.map((d) => (
                  <tr key={d.advance_id}>
                    <td>{formatDate(d.requestedDate)}</td>
                    <td>{d.reason.replace(/_/g, " ")}</td>
                    <td className="num">{money(d.amount)}</td>
                    <td className="num">{d.fee > 0 ? money(d.fee) : "free"}</td>
                    <td className="num">{d.daysOutstanding}</td>
                    <td className="num">{d.fee > 0 ? pct(d.effectiveApr) : "—"}</td>
                    <td>
                      {d.status === "outstanding" ? (
                        <Badge tone="warn">outstanding</Badge>
                      ) : (
                        <Badge tone="neutral">repaid</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      <div className="section">
        <Card title="Across the whole cohort" sub="Why this product should exist, in one row of numbers.">
          <div className="grid grid-stats">
            <StatCard
              label="Workers using advances"
              value={`${cohort.workersWithAdvances} / ${cohort.totalWorkers}`}
              sub="of the synthetic cohort took at least one advance"
            />
            <StatCard label="Total advances" value={String(cohort.totalAdvances)} sub="in ~14 weeks" />
            <StatCard
              label="Cohort fees paid"
              value={money(cohort.totalFees)}
              tone="bad"
              sub={`≈ ${money0((cohort.totalFees / Math.max(1, model.dailyIncome.length)) * 365)}/year at this pace`}
            />
            <StatCard
              label="Fee per advance-user"
              value={money(cohort.totalFees / Math.max(1, cohort.workersWithAdvances))}
              sub="quiet tax on the people with the least slack"
            />
          </div>
        </Card>
      </div>
    </>
  );
}
