const DAY_MS = 86_400_000;

/** Parse "YYYY-MM-DD" (or the date part of an ISO timestamp) to UTC ms. */
export function dayMs(date: string): number {
  const d = date.slice(0, 10);
  return Date.parse(`${d}T00:00:00Z`);
}

export function toISODate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return toISODate(dayMs(date) + days * DAY_MS);
}

export function diffDays(a: string, b: string): number {
  return Math.round((dayMs(a) - dayMs(b)) / DAY_MS);
}

/** Inclusive list of ISO dates. */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let t = dayMs(start); t <= dayMs(end); t += DAY_MS) out.push(toISODate(t));
  return out;
}

export function dayOfWeek(date: string): number {
  return new Date(dayMs(date)).getUTCDay(); // 0 = Sunday
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDate(date: string): string {
  const d = new Date(dayMs(date));
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatDateLong(date: string): string {
  const d = new Date(dayMs(date));
  return d.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Next occurrence (>= from) of a monthly due day, clamping day to month length. */
export function nextDueDate(from: string, dueDayOfMonth: number): string {
  const f = new Date(dayMs(from));
  for (let k = 0; k < 3; k++) {
    const y = f.getUTCFullYear();
    const m = f.getUTCMonth() + k;
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const candidate = new Date(Date.UTC(y, m, Math.min(dueDayOfMonth, lastDay)));
    const iso = candidate.toISOString().slice(0, 10);
    if (dayMs(iso) >= dayMs(from)) return iso;
  }
  return addDays(from, 30);
}
