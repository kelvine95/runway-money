import { useMemo } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WorkerModel } from "../lib/engine";
import { simulateSteadyPaycheck } from "../lib/steadyPaycheck";
import { money, money0, pct } from "../lib/format";
import { formatDate, formatDateLong } from "../lib/dates";
import { Callout, Card, StatCard } from "../components/ui";
import { tooltipStyle } from "./TodayView";

export default function PaycheckView({ model }: { model: WorkerModel }) {
  const result = useMemo(() => simulateSteadyPaycheck(model), [model]);

  const chartData = result.sim.map((s) => ({
    date: s.date,
    income: Math.round(s.actualIncome),
    paycheck: Math.round(s.paycheck),
    buffer: Math.round(s.holdingBalance),
  }));

  const weeklySteady = result.dailyPaycheck * 7;

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Steady Paycheck</h2>
          <p className="subtitle">
            The "pay yourself a salary" method that every irregular-income guide recommends —
            computed and replayed against your actual history instead of left as homework.
          </p>
        </div>
        <span className="asof">as of {formatDateLong(model.asOf)}</span>
      </div>

      <div className="grid grid-stats">
        <StatCard
          label="Your steady paycheck"
          value={`${money0(result.dailyPaycheck)}/day`}
          tone="good"
          sub={`${money0(weeklySteady)}/week — your income floor (P25 of your own weeks)`}
        />
        <StatCard
          label="Paycheck reliability"
          value={pct(result.reliability)}
          tone={result.reliability >= 0.95 ? "good" : result.reliability >= 0.85 ? "warn" : "bad"}
          sub="days the buffer could pay you in full, replaying your real history"
        />
        <StatCard
          label="Buffer built"
          value={money(result.endingBuffer)}
          sub="surplus from strong days, sitting between you and the next slow week"
        />
        <StatCard
          label="Advance fees avoided"
          value={money(result.avoidableFees)}
          tone={result.avoidableFees > 0 ? "good" : "neutral"}
          sub={
            result.totalAdvances > 0
              ? `${result.avoidableAdvances} of ${result.totalAdvances} advances wouldn't have been needed`
              : "no advances taken in this period"
          }
        />
      </div>

      <div className="section">
        {result.avoidableAdvances > 0 ? (
          <Callout tone="good">
            Replaying the last {result.sim.length} days: if strong days had auto-filled a holding
            buffer and you'd been paid <strong>{money0(result.dailyPaycheck)} every day</strong>,
            the buffer would have absorbed <strong>{result.avoidableAdvances}</strong> of your{" "}
            {result.totalAdvances} wage advances — keeping{" "}
            <strong>{money(result.avoidableFees)}</strong> in fees in your pocket.
          </Callout>
        ) : (
          <Callout tone="info">
            A steady paycheck of <strong>{money0(result.dailyPaycheck)}/day</strong> would have
            been payable in full on {pct(result.reliability)} of days — turning{" "}
            {model.worker.pay_type} pay into something you can plan rent around.
          </Callout>
        )}
      </div>

      <div className="section">
        <Card
          title="Spiky reality vs. steady paycheck"
          sub="Bars: what you actually earned each day. Line: what Runway would pay you instead."
        >
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
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
                tickFormatter={(v: number) => `$${v}`}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(d) => formatDateLong(String(d))}
                formatter={(v, name) => [
                  money(Number(v)),
                  name === "income" ? "actual earnings" : "steady paycheck",
                ]}
              />
              <Bar dataKey="income" fill="#2e4057" radius={[3, 3, 0, 0]} />
              <Line
                type="monotone"
                dataKey="paycheck"
                stroke="#a3e635"
                strokeWidth={2.5}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="section">
        <Card
          title="The buffer that makes it possible"
          sub="Strong days fill it, slow days drain it. This is the money that replaces borrowing."
        >
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={chartData} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
              <defs>
                <linearGradient id="bufGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
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
                tickFormatter={(v: number) => `$${v}`}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(d) => formatDateLong(String(d))}
                formatter={(v) => [money(Number(v)), "holding buffer"]}
              />
              <Area
                type="monotone"
                dataKey="buffer"
                stroke="#34d399"
                strokeWidth={2}
                fill="url(#bufGrad)"
              />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="chart-note">
            Method: all earnings land in a holding account; you're paid{" "}
            {money0(result.dailyPaycheck)}/day from it. The floor is the 25th percentile of your
            observed full weeks ({money0(result.weeklyFloor)}/week), so 3 of 4 weeks build surplus.
          </p>
        </Card>
      </div>
    </>
  );
}
