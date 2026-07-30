import type { ReactNode } from "react";

export function StatCard(props: {
  label: string;
  value: string;
  sub?: ReactNode;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  return (
    <div className={`stat-card tone-${props.tone ?? "neutral"}`}>
      <div className="stat-label">{props.label}</div>
      <div className="stat-value">{props.value}</div>
      {props.sub && <div className="stat-sub">{props.sub}</div>}
    </div>
  );
}

export function Card(props: { title?: string; sub?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`card ${props.className ?? ""}`}>
      {props.title && (
        <div className="card-head">
          <h3>{props.title}</h3>
          {props.sub && <p>{props.sub}</p>}
        </div>
      )}
      {props.children}
    </div>
  );
}

export function Callout(props: { tone: "good" | "warn" | "bad" | "info"; children: ReactNode }) {
  return <div className={`callout callout-${props.tone}`}>{props.children}</div>;
}

export function ProgressBar(props: { value: number; tone?: "good" | "warn" | "bad" }) {
  const clamped = Math.max(0, Math.min(1, props.value));
  const tone = props.tone ?? (clamped >= 0.9 ? "good" : clamped >= 0.6 ? "warn" : "bad");
  return (
    <div className="progress">
      <div className={`progress-fill fill-${tone}`} style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}

export function Badge(props: { tone?: "good" | "warn" | "bad" | "neutral"; children: ReactNode }) {
  return <span className={`badge badge-${props.tone ?? "neutral"}`}>{props.children}</span>;
}
