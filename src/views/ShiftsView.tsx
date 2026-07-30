import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WorkerModel } from "../lib/engine";
import { computeShiftRoi } from "../lib/shiftRoi";
import { money, money0, num, pct } from "../lib/format";
import { formatDateLong } from "../lib/dates";
import { Callout, Card, StatCard } from "../components/ui";
import { tooltipStyle } from "./TodayView";

export default function ShiftsView({ model }: { model: WorkerModel }) {
  const roi = useMemo(() => computeShiftRoi(model), [model]);

  const weekdayData = roi.byWeekday.map((s) => ({
    label: s.label,
    perHour: Number(s.medianNetPerHour.toFixed(2)),
    shifts: s.shifts,
  }));
  const shiftTypeData = roi.byShiftType.map((s) => ({
    label: s.label,
    perHour: Number(s.medianNetPerHour.toFixed(2)),
    shifts: s.shifts,
  }));

  const best = roi.bestSlot;
  const worst = roi.worstSlot;

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Shift ROI</h2>
          <p className="subtitle">
            Budget apps optimize what you spend. For a daily earner the bigger lever is{" "}
            <strong>which work you say yes to</strong> — this is your own pay history, priced per
            hour.
          </p>
        </div>
        <span className="asof">as of {formatDateLong(model.asOf)}</span>
      </div>

      <div className="grid grid-stats">
        <StatCard
          label="Median take-home"
          value={`${money(roi.overallMedianPerHour)}/hr`}
          sub={`across ${model.earnings.length} shifts on record`}
        />
        <StatCard
          label="Best day to work"
          value={best ? best.label : "—"}
          tone="good"
          sub={best ? `${money(best.medianNetPerHour)}/hr median (${best.shifts} shifts)` : ""}
        />
        <StatCard
          label="Weakest day"
          value={worst ? worst.label : "—"}
          tone="warn"
          sub={worst ? `${money(worst.medianNetPerHour)}/hr median (${worst.shifts} shifts)` : ""}
        />
        <StatCard
          label="Same-day pay"
          value={pct(
            model.earnings.length > 0
              ? model.earnings.filter((e) => e.paid_same_day === 1).length /
                  model.earnings.length
              : 0,
          )}
          sub="shifts paid out the day you worked them"
        />
      </div>

      {best && worst && best !== worst && roi.monthlyUpside > 20 && (
        <div className="section">
          <Callout tone="info">
            Swapping one <strong>{worst.label}</strong> shift a week for a{" "}
            <strong>{best.label}</strong> shift is worth roughly{" "}
            <strong>{money0(roi.monthlyUpside)}/month</strong> at your average{" "}
            {num(roi.avgHoursPerShift, 1)}-hour shift — the same money as{" "}
            {num(roi.monthlyUpside / Math.max(1, model.medianNetPerShift), 1)} extra shifts,
            without working them.
          </Callout>
        </div>
      )}

      <div className="grid grid-2-even section">
        <Card title="Take-home $/hour by day of week" sub="Median net per hour; taller is better.">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={weekdayData} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
              <CartesianGrid stroke="#1e2833" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#5c6b78", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#1e2833" }}
              />
              <YAxis
                tick={{ fill: "#5c6b78", fontSize: 11 }}
                tickFormatter={(v: number) => `$${v}`}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, name) =>
                  name === "perHour" ? [money(Number(v)) + "/hr", "median"] : [String(v), "shifts"]
                }
              />
              <Bar dataKey="perHour" radius={[4, 4, 0, 0]}>
                {weekdayData.map((d) => (
                  <Cell
                    key={d.label}
                    fill={
                      best && d.label === best.label
                        ? "#a3e635"
                        : worst && d.label === worst.label
                          ? "#f87171"
                          : "#2e4057"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Take-home $/hour by shift type" sub="Night vs day vs split — what the clock is worth.">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={shiftTypeData} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
              <CartesianGrid stroke="#1e2833" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#5c6b78", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#1e2833" }}
              />
              <YAxis
                tick={{ fill: "#5c6b78", fontSize: 11 }}
                tickFormatter={(v: number) => `$${v}`}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, name) =>
                  name === "perHour" ? [money(Number(v)) + "/hr", "median"] : [String(v), "shifts"]
                }
              />
              <Bar dataKey="perHour" fill="#60a5fa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="section">
        <Card
          title="By employer"
          sub="Multiple income sources are normal for daily earners — here's which ones respect your hour."
        >
          <table>
            <thead>
              <tr>
                <th>Employer</th>
                <th className="num">Shifts</th>
                <th className="num">$/hr (median)</th>
                <th className="num">$/shift (median)</th>
                <th className="num">Tips</th>
                <th className="num">Same-day pay</th>
              </tr>
            </thead>
            <tbody>
              {roi.byEmployer.map((s) => (
                <tr key={s.label}>
                  <td>{s.label}</td>
                  <td className="num">{s.shifts}</td>
                  <td className="num">{money(s.medianNetPerHour)}</td>
                  <td className="num">{money(s.medianNetPerShift)}</td>
                  <td className="num">{pct(s.tipShare)}</td>
                  <td className="num">{pct(s.sameDayPayShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
