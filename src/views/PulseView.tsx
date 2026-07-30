import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WorkerModel } from "../lib/engine";
import {
  CANADA_MACRO,
  MACRO_AS_OF,
  US_MACRO,
  computePersonalPressure,
  LIVING_WAGE_SOURCE,
} from "../lib/economicContext";
import { computeSafeToSpend } from "../lib/safeToSpend";
import { money, money0, num, pct } from "../lib/format";
import { Badge, Callout, Card, ProgressBar, StatCard } from "../components/ui";
import { tooltipStyle } from "./TodayView";

type Energy = "drained" | "steady" | "strong";

interface DailyEntry {
  energy?: Energy;
  completed: string[];
}

type PulseHistory = Record<string, DailyEntry>;

interface Mission {
  id: string;
  title: string;
  detail: string;
  reward: string;
}

const todayKey = () => new Date().toISOString().slice(0, 10);

function loadHistory(workerId: string): PulseHistory {
  try {
    return JSON.parse(localStorage.getItem(`runway-pulse:${workerId}`) ?? "{}") as PulseHistory;
  } catch {
    return {};
  }
}

function streakFrom(history: PulseHistory): number {
  const active = new Set(
    Object.entries(history)
      .filter(([, entry]) => entry.energy || entry.completed.length > 0)
      .map(([date]) => date),
  );
  const cursor = new Date();
  let streak = 0;
  for (let day = 0; day < 365; day++) {
    const key = cursor.toISOString().slice(0, 10);
    if (!active.has(key)) break;
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export default function PulseView({ model }: { model: WorkerModel }) {
  const pressure = useMemo(() => computePersonalPressure(model), [model]);
  const safe = useMemo(() => computeSafeToSpend(model), [model]);
  const [history, setHistory] = useState<PulseHistory>(() =>
    loadHistory(model.worker.worker_id),
  );
  const date = todayKey();
  const entry = history[date] ?? { completed: [] };

  useEffect(() => {
    setHistory(loadHistory(model.worker.worker_id));
  }, [model.worker.worker_id]);

  const missions = useMemo<Mission[]>(() => {
    const adaptive: Mission =
      safe.shortfall > 0
        ? {
            id: "protect",
            title: `Close ${money0(Math.min(safe.shortfall, model.medianNetPerShift))} of the gap`,
            detail: "Claim one realistic shift or expense move—no savings pressure on a lean day.",
            reward: "+15 resilience",
          }
        : {
            id: "buffer",
            title: `Keep ${money0(Math.min(safe.safeToday * 0.25, 15))} from today's flex`,
            detail: "A tiny surplus-day transfer grows the buffer without a fixed commitment.",
            reward: "+15 resilience",
          };

    return [
      adaptive,
      {
        id: "body",
        title: "Protect tomorrow's earning energy",
        detail: "Pick one: pack food, take a real break, hydrate, or stop work on time.",
        reward: "+15 energy",
      },
      {
        id: "joy",
        title: safe.safeToday >= 5 ? "Spend a little without guilt" : "Choose one free reset",
        detail:
          safe.safeToday >= 5
            ? `${money(Math.min(5, safe.safeToday))} fits inside today's safe-to-spend—enjoy it deliberately.`
            : "A walk, music, a call, or 20 quiet minutes counts. Scarcity should not erase life.",
        reward: "+15 balance",
      },
    ];
  }, [model.medianNetPerShift, safe]);

  const setEnergy = (energy: Energy) => {
    setHistory((current) => {
      const next = { ...current, [date]: { ...entry, energy } };
      localStorage.setItem(`runway-pulse:${model.worker.worker_id}`, JSON.stringify(next));
      return next;
    });
  };

  const toggleMission = (missionId: string) => {
    const completed = entry.completed.includes(missionId)
      ? entry.completed.filter((id) => id !== missionId)
      : [...entry.completed, missionId];
    setHistory((current) => {
      const next = { ...current, [date]: { ...entry, completed } };
      localStorage.setItem(`runway-pulse:${model.worker.worker_id}`, JSON.stringify(next));
      return next;
    });
  };

  const allEntries = Object.values(history);
  const completedCount = allEntries.reduce((total, day) => total + day.completed.length, 0);
  const checkInCount = allEntries.filter((day) => day.energy).length;
  const points = completedCount * 15 + checkInCount * 10;
  const level = Math.floor(points / 100) + 1;
  const levelProgress = (points % 100) / 100;
  const streak = streakFrom(history);
  const missionProgress = entry.completed.length / missions.length;

  const categoryData = pressure.categoryPressure.slice(0, 6).map((category) => ({
    category: category.category.replace(/_/g, " "),
    inflation: category.inflation,
    share: category.share,
  }));

  const lifeMoney = Math.max(0, safe.safeToday);
  const lifeBudget = [
    { label: "Enjoy today", amount: lifeMoney * 0.2, note: "guilt-free" },
    { label: "Daily needs", amount: lifeMoney * 0.5, note: "food, transit, life" },
    { label: "Future you", amount: lifeMoney * 0.3, note: "optional buffer boost" },
  ];

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Life Pulse</h2>
          <p className="subtitle">
            Your money in the world around it: local cost pressure, earning power, and one
            humane daily ritual that protects both your runway and your life.
          </p>
        </div>
        <span className="asof">economic snapshot · {MACRO_AS_OF}</span>
      </div>

      <div className="pulse-hero">
        <div>
          <span className="eyebrow">Today’s check-in</span>
          <h3>How much energy do you have—not how productive should you be?</h3>
          <div className="energy-picker">
            {(
              [
                ["drained", "Low battery"],
                ["steady", "Steady"],
                ["strong", "Ready to go"],
              ] as [Energy, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                className={entry.energy === value ? "selected" : ""}
                onClick={() => setEnergy(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="pulse-score">
          <span>Level {level}</span>
          <strong>{points}</strong>
          <small>resilience points</small>
          <ProgressBar value={levelProgress} tone="good" />
          <small>{streak > 0 ? `${streak}-day gentle streak` : "Start today—no lost-streak shame"}</small>
        </div>
      </div>

      <div className="grid grid-stats section">
        <StatCard
          label="Your personal inflation"
          value={pct(pressure.personalInflation / 100, 1)}
          tone={pressure.personalInflation > 3.4 ? "bad" : "warn"}
          sub={`weighted by where ${model.worker.worker_id} actually spends essentials`}
        />
        <StatCard
          label={`${model.worker.city} living wage`}
          value={`${money(pressure.livingWage)}/hr`}
          sub="2025 Alberta Living Wage Network benchmark"
        />
        <StatCard
          label="Your observed take-home"
          value={`${money(pressure.observedHourlyNet)}/hr`}
          tone={pressure.livingWageGap >= 0 ? "good" : "bad"}
          sub={`${money(pressure.livingWageGap)}/hr ${pressure.livingWageGap >= 0 ? "above" : "below"} local living wage`}
        />
        <StatCard
          label="Inflation drag"
          value={`${num(pressure.dragInShifts, 1)} shifts/mo`}
          tone={pressure.dragInShifts > 0.5 ? "bad" : "warn"}
          sub={`${money(pressure.monthlyInflationDrag)}/month of purchasing power pressure`}
        />
      </div>

      <div className="section">
        {pressure.livingWageGap < 0 ? (
          <Callout tone="warn">
            This worker’s observed take-home is <strong>{money(Math.abs(pressure.livingWageGap))}/hr
            below</strong> the {model.worker.city} living-wage benchmark. That is a structural
            income gap—not a personal budgeting failure.
          </Callout>
        ) : (
          <Callout tone="good">
            Observed take-home is <strong>{money(pressure.livingWageGap)}/hr above</strong> the
            local living-wage benchmark. Strong days are the right time for a small, optional
            buffer nudge.
          </Callout>
        )}
      </div>

      <div className="grid grid-2 section">
        <Card
          title="Three small wins for today"
          sub="Adaptive: surplus days invite tiny saving; lean days focus on protection, never pressure."
        >
          <div className="mission-progress">
            <span>{entry.completed.length} of {missions.length} complete</span>
            <ProgressBar value={missionProgress} tone="good" />
          </div>
          <div className="mission-list">
            {missions.map((mission) => {
              const complete = entry.completed.includes(mission.id);
              return (
                <button
                  key={mission.id}
                  className={`mission ${complete ? "complete" : ""}`}
                  onClick={() => toggleMission(mission.id)}
                >
                  <span className="mission-check">{complete ? "✓" : ""}</span>
                  <span>
                    <strong>{mission.title}</strong>
                    <small>{mission.detail}</small>
                  </span>
                  <Badge tone={complete ? "good" : "neutral"}>{mission.reward}</Badge>
                </button>
              );
            })}
          </div>
        </Card>

        <Card
          title="A life budget—not just a survival budget"
          sub="A suggested split of today’s genuinely safe money. Future-you saving stays optional."
        >
          {lifeMoney > 0 ? (
            <div className="life-budget">
              {lifeBudget.map((item) => (
                <div className="life-budget-row" key={item.label}>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.note}</small>
                  </div>
                  <span>{money(item.amount)}</span>
                </div>
              ))}
              <div className="life-total">
                <span>Safe today</span>
                <strong>{money(lifeMoney)}</strong>
              </div>
            </div>
          ) : (
            <Callout tone="info">
              There is no safe flex money today, so Runway will not manufacture a savings goal.
              Today’s win is protecting essentials and energy.
            </Callout>
          )}
        </Card>
      </div>

      <div className="grid grid-2-even section">
        <Card
          title="What inflation feels like for this worker"
          sub="Official Canadian category inflation, weighted separately by this worker’s spending."
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={categoryData} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
              <CartesianGrid stroke="#1e2833" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="category"
                tick={{ fill: "#5c6b78", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "#1e2833" }}
              />
              <YAxis
                tick={{ fill: "#5c6b78", fontSize: 11 }}
                tickFormatter={(value: number) => `${value}%`}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name) =>
                  name === "inflation"
                    ? [`${Number(value).toFixed(1)}%`, "12-month inflation"]
                    : [pct(Number(value)), "spend share"]
                }
              />
              <Bar dataKey="inflation" fill="#fbbf24" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="chart-note">
            This is context, not a forecast input: the worker history ends before the latest
            macro releases, so using them to rewrite that simulation would introduce hindsight.
          </p>
        </Card>

        <Card title="Canada vs. US pulse" sub="Official reference points—not apples-to-apples household budgets.">
          <div className="macro-columns">
            <MacroColumn title="Canada / Alberta" metrics={CANADA_MACRO} />
            <MacroColumn title="United States" metrics={US_MACRO} />
          </div>
          <p className="chart-note">
            Sources: official releases from Statistics Canada, Bank of Canada, US BLS, and the
            Federal Reserve. Each value links to its release.
          </p>
        </Card>
      </div>

      <div className="section">
        <Card title="Why the baseline matters">
          <div className="context-strip">
            <div>
              <strong>$15.00/hr</strong>
              <span>Alberta minimum wage, unchanged since 2018</span>
            </div>
            <div>
              <strong>+6.7%</strong>
              <span>Canada transportation inflation</span>
            </div>
            <div>
              <strong>+3.9%</strong>
              <span>Canada grocery inflation</span>
            </div>
            <div>
              <strong>+20.5%</strong>
              <span>Canada gasoline inflation</span>
            </div>
          </div>
          <p className="source-line">
            Living-wage benchmark:{" "}
            <a href={LIVING_WAGE_SOURCE} target="_blank" rel="noreferrer">
              Alberta Living Wage Network
            </a>
            . Inflation:{" "}
            <a
              href="https://www150.statcan.gc.ca/n1/daily-quotidien/260720/dq260720a-eng.htm"
              target="_blank"
              rel="noreferrer"
            >
              Statistics Canada, June 2026 CPI
            </a>
            .
          </p>
        </Card>
      </div>
    </>
  );
}

function MacroColumn({
  title,
  metrics,
}: {
  title: string;
  metrics: typeof CANADA_MACRO;
}) {
  return (
    <div className="macro-column">
      <h4>{title}</h4>
      {metrics.map((metric) => (
        <a
          className="macro-row"
          href={metric.sourceUrl}
          target="_blank"
          rel="noreferrer"
          key={metric.label}
        >
          <span>
            <strong>{metric.label}</strong>
            <small>{metric.note}</small>
          </span>
          <b>{metric.value.toFixed(metric.value % 1 === 0 ? 1 : 2)}%</b>
        </a>
      ))}
    </div>
  );
}
