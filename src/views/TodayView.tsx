import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WorkerModel } from "../lib/engine";
import { computeSafeToSpend, runwayDays } from "../lib/safeToSpend";
import { forecastRunway } from "../lib/runway";
import { money, money0, num } from "../lib/format";
import { formatDate, formatDateLong } from "../lib/dates";
import { Badge, Callout, Card, StatCard } from "../components/ui";

export default function TodayView({ model }: { model: WorkerModel }) {
  const sts = useMemo(() => computeSafeToSpend(model), [model]);
  const forecast = useMemo(() => forecastRunway(model), [model]);
  const runway = runwayDays(model);

  const nextBill = model.upcomingBills[0];
  const nextBillCoverage = forecast.billCoverage.find(
    (b) => b.bill.obligation.obligation_id === nextBill?.obligation.obligation_id,
  );

  const balanceData = model.balanceSeries.slice(-56).map((b) => ({
    date: b.date,
    balance: Math.round(b.balance),
  }));

  const stsTone = sts.safeToday > 20 ? "good" : sts.safeToday > 0 ? "warn" : "bad";
  const runwayTone = runway >= 14 ? "good" : runway >= 5 ? "warn" : "bad";

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Today</h2>
          <p className="subtitle">
            Not your bank balance — the number that already accounts for your bills, your
            essentials, and a bad week of income.
          </p>
        </div>
        <span className="asof">as of {formatDateLong(model.asOf)}</span>
      </div>

      <div className="grid grid-stats">
        <StatCard
          label="Safe to spend today"
          value={money(sts.safeToday)}
          tone={stsTone}
          sub={`flex money per day for the next ${sts.horizonDays} days`}
        />
        <StatCard
          label="Bank balance"
          value={money(sts.balance)}
          sub="what your banking app shows — and why it misleads"
        />
        <StatCard
          label="Runway with zero income"
          value={`${num(Math.max(0, runway), 1)} days`}
          tone={runwayTone}
          sub="how long the balance lasts if no shifts come"
        />
        <StatCard
          label="Next bill"
          value={nextBill ? money(nextBill.obligation.amount_cad) : "—"}
          tone={
            nextBillCoverage && nextBillCoverage.coverage < 0.7
              ? "bad"
              : nextBillCoverage && nextBillCoverage.coverage < 0.9
                ? "warn"
                : "neutral"
          }
          sub={
            nextBill
              ? `${nextBill.obligation.name} · due ${formatDate(nextBill.dueDate)} (${nextBill.daysUntil}d)`
              : "no bills in the next 35 days"
          }
        />
      </div>

      <div className="section">
        {sts.shortfall > 0 && (
          <Callout tone="bad">
            You're <strong>{money0(sts.shortfall)} short</strong> of covering the next{" "}
            {sts.horizonDays} days plus a {sts.bufferDaysTarget}-day buffer — about{" "}
            <strong>{num(Math.ceil(sts.shiftsToCover * 10) / 10, 1)} extra shifts</strong> at your
            median take-home of {money0(model.medianNetPerShift)}/shift.
          </Callout>
        )}
        {nextBillCoverage && nextBillCoverage.coverage < 0.9 && (
          <Callout tone="warn">
            <strong>{nextBill!.obligation.name}</strong> ({money0(nextBill!.obligation.amount_cad)}
            , due {formatDate(nextBill!.dueDate)}) clears in only{" "}
            <strong>{Math.round(nextBillCoverage.coverage * 100)}%</strong> of simulated futures at
            your current pace
            {nextBillCoverage.shiftsNeeded > 0 && (
              <>
                {" "}
                — roughly <strong>{num(Math.ceil(nextBillCoverage.shiftsNeeded * 10) / 10, 1)} more
                shifts</strong> before the due date closes the gap
              </>
            )}
            .
          </Callout>
        )}
        {sts.shortfall === 0 && (!nextBillCoverage || nextBillCoverage.coverage >= 0.9) && (
          <Callout tone="good">
            Bills, essentials, and your {sts.bufferDaysTarget}-day buffer are covered even on a
            weak income stretch. The {money(sts.safeToday)}/day above is genuinely yours to spend.
          </Callout>
        )}
      </div>

      <div className="grid grid-2 section">
        <Card
          title="Balance — last 8 weeks"
          sub="Rebuilt from the transaction ledger. Notice the bill-day cliffs."
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={balanceData} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
              <defs>
                <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a3e635" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#a3e635" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e2833" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fill: "#5c6b78", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#1e2833" }}
                minTickGap={40}
              />
              <YAxis
                tick={{ fill: "#5c6b78", fontSize: 11 }}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(d) => formatDateLong(String(d))}
                formatter={(v) => [money(Number(v)), "balance"]}
              />
              <ReferenceLine y={0} stroke="#f87171" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#a3e635"
                strokeWidth={2}
                fill="url(#balGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card
          title="How today's number is built"
          sub={`Income assumed at your 25th-percentile week — planning for a bad stretch, not an average one.`}
        >
          <div className="breakdown">
            <Row desc="Bank balance now" amt={sts.balance} pos />
            <Row
              desc={`Income, next ${sts.horizonDays} days`}
              small="25th percentile of your own weeks"
              amt={sts.conservativeIncome}
              pos
            />
            <Row desc="Bills due in window" amt={-sts.billsDue} />
            <Row
              desc="Essentials (groceries, transit…)"
              small={`${money(model.dailyEssentialSpend)}/day observed`}
              amt={-sts.essentials}
            />
            <Row
              desc={`${sts.bufferDaysTarget}-day buffer floor`}
              small="kept aside so one bad week doesn't become a loan"
              amt={-sts.bufferFloor}
            />
            <div className="breakdown-row total">
              <span className="desc">Flex over {sts.horizonDays} days</span>
              <span className={`amt ${sts.flexTotal >= 0 ? "pos" : "neg"}`}>
                {money(sts.flexTotal)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <div className="section">
        <Card title="Bills in the next 35 days" sub="Funding confidence from 400 simulated futures based on your real earning pattern.">
          {model.upcomingBills.length === 0 && <p>No scheduled bills found.</p>}
          {model.upcomingBills.map((b) => {
            const cov = forecast.billCoverage.find(
              (c) => c.bill.obligation.obligation_id === b.obligation.obligation_id,
            );
            return (
              <div className="bill-row" key={b.obligation.obligation_id}>
                <div>
                  <div className="bill-name">
                    {b.obligation.name}{" "}
                    {b.obligation.autopay === 1 && <Badge tone="neutral">autopay</Badge>}
                  </div>
                  <div className="bill-meta">
                    due {formatDateLong(b.dueDate)} · in {b.daysUntil} days
                  </div>
                </div>
                <div className="bill-right">
                  <div className="bill-amount">{money(b.obligation.amount_cad)}</div>
                  <div className="bill-meta">
                    {cov ? `${Math.round(cov.coverage * 100)}% funded confidence` : "beyond forecast"}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </>
  );
}

function Row(props: { desc: string; small?: string; amt: number; pos?: boolean }) {
  return (
    <div className="breakdown-row">
      <span className="desc">
        {props.desc}
        {props.small && <small>{props.small}</small>}
      </span>
      <span className={`amt ${props.amt >= 0 && props.pos ? "pos" : props.amt < 0 ? "neg" : ""}`}>
        {props.amt >= 0 ? "+" : "−"}
        {money(Math.abs(props.amt))}
      </span>
    </div>
  );
}

export const tooltipStyle: React.CSSProperties = {
  background: "#141c25",
  border: "1px solid #1e2833",
  borderRadius: 10,
  fontSize: 12,
  color: "#e8eef4",
};
