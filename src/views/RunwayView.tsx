import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WorkerModel } from "../lib/engine";
import { forecastRunway } from "../lib/runway";
import { money, money0, num, pct } from "../lib/format";
import { formatDate, formatDateLong } from "../lib/dates";
import { Badge, Callout, Card, ProgressBar, StatCard } from "../components/ui";
import { tooltipStyle } from "./TodayView";

export default function RunwayView({ model }: { model: WorkerModel }) {
  const forecast = useMemo(() => forecastRunway(model), [model]);

  const chartData = forecast.days.map((d) => ({
    date: d.date,
    band: [Math.round(d.p10), Math.round(d.p90)] as [number, number],
    p50: Math.round(d.p50),
  }));

  const billDots = forecast.days.filter((d) => d.bills.length > 0);
  const riskiest = [...forecast.billCoverage].sort((a, b) => a.coverage - b.coverage)[0];

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Bill Runway</h2>
          <p className="subtitle">
            400 possible versions of your next 30 days, sampled from how you actually earn. Gaps
            are quoted in <strong>shifts</strong>, because that's the lever you control.
          </p>
        </div>
        <span className="asof">as of {formatDateLong(model.asOf)}</span>
      </div>

      <div className="grid grid-stats">
        <StatCard
          label="Median path breaks"
          value={forecast.medianBreakDay ? formatDate(forecast.medianBreakDay) : "never"}
          tone={forecast.medianBreakDay ? "bad" : "good"}
          sub={
            forecast.medianBreakDay
              ? "the typical simulated future goes negative on this day"
              : "the typical simulated future stays above zero for 30 days"
          }
        />
        <StatCard
          label="Risk of ending month negative"
          value={pct(forecast.probNegative30)}
          tone={
            forecast.probNegative30 > 0.3 ? "bad" : forecast.probNegative30 > 0.1 ? "warn" : "good"
          }
          sub="share of simulations below $0 on day 30"
        />
        <StatCard
          label="Your median shift"
          value={money0(model.medianNetPerShift)}
          sub={`take-home; you work ~${num(model.workDaysPerWeek, 1)} days/week`}
        />
        <StatCard
          label="Bills in window"
          value={money0(
            forecast.billCoverage.reduce((s, b) => s + b.bill.obligation.amount_cad, 0),
          )}
          sub={`${forecast.billCoverage.length} scheduled payments in 30 days`}
        />
      </div>

      <div className="section">
        {riskiest && riskiest.coverage < 0.9 ? (
          <Callout tone={riskiest.coverage < 0.7 ? "bad" : "warn"}>
            Most at risk: <strong>{riskiest.bill.obligation.name}</strong> (
            {money0(riskiest.bill.obligation.amount_cad)}, due{" "}
            {formatDate(riskiest.bill.dueDate)}). It clears in{" "}
            <strong>{pct(riskiest.coverage)}</strong> of futures. Median gap when it fails:{" "}
            <strong>{money0(riskiest.medianShortfall)}</strong> ≈{" "}
            <strong>{num(Math.ceil(riskiest.shiftsNeeded * 10) / 10, 1)} shifts</strong> — with{" "}
            {riskiest.bill.daysUntil} days to pick them up.
          </Callout>
        ) : (
          <Callout tone="good">
            Every scheduled bill in the next 30 days clears in at least 90% of simulated futures.
            No extra shifts required at your current pace.
          </Callout>
        )}
      </div>

      <div className="section">
        <Card
          title="30-day balance forecast"
          sub="Shaded band: 10th–90th percentile of 400 simulations. Line: median path. Dots: bill due dates."
        >
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 6 }}>
              <defs>
                <linearGradient id="fanGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.06} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e2833" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fill: "#5c6b78", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#1e2833" }}
                minTickGap={30}
              />
              <YAxis
                tick={{ fill: "#5c6b78", fontSize: 11 }}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(d) => formatDateLong(String(d))}
                formatter={(v, name) => {
                  if (name === "band") {
                    const [lo, hi] = v as [number, number];
                    return [`${money(lo)} – ${money(hi)}`, "10th–90th pct"];
                  }
                  return [money(Number(v)), "median"];
                }}
              />
              <ReferenceLine y={0} stroke="#f87171" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="band"
                stroke="none"
                fill="url(#fanGrad)"
                connectNulls
              />
              <Line type="monotone" dataKey="p50" stroke="#60a5fa" strokeWidth={2.5} dot={false} />
              {billDots.map((d) => (
                <ReferenceDot
                  key={d.date}
                  x={d.date}
                  y={d.p50}
                  r={4.5}
                  fill="#fbbf24"
                  stroke="#0a0e13"
                  strokeWidth={1.5}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="section">
        <Card
          title="Per-bill funding confidence"
          sub="For each due date: the share of simulated futures where the bill clears without the balance going negative."
        >
          {forecast.billCoverage.length === 0 && <p>No bills inside the 30-day window.</p>}
          {forecast.billCoverage.map((c) => (
            <div className="bill-row" key={c.bill.obligation.obligation_id}>
              <div>
                <div className="bill-name">
                  {c.bill.obligation.name}{" "}
                  {c.coverage < 0.7 ? (
                    <Badge tone="bad">at risk</Badge>
                  ) : c.coverage < 0.9 ? (
                    <Badge tone="warn">tight</Badge>
                  ) : (
                    <Badge tone="good">on track</Badge>
                  )}
                </div>
                <div className="bill-meta">
                  {money(c.bill.obligation.amount_cad)} · due {formatDateLong(c.bill.dueDate)} · in{" "}
                  {c.bill.daysUntil} days
                  {c.shiftsNeeded > 0.05 && (
                    <>
                      {" "}
                      · needs ~{num(Math.ceil(c.shiftsNeeded * 10) / 10, 1)} extra shifts if the
                      gap hits
                    </>
                  )}
                </div>
              </div>
              <div className="bill-right">
                <div className="bill-amount">{pct(c.coverage)}</div>
                <div className="bill-meta">funded confidence</div>
              </div>
              <ProgressBar value={c.coverage} />
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
