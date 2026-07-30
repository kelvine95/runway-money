import type { WorkerModel } from "./engine";
import { WEEKDAY_LABELS, dayOfWeek } from "./dates";
import { groupBy, mean, median, sum } from "./stats";

export interface SlotStats {
  label: string;
  shifts: number;
  medianNetPerHour: number;
  medianNetPerShift: number;
  tipShare: number;
  sameDayPayShare: number;
}

export interface ShiftRoi {
  byEmployer: SlotStats[];
  byShiftType: SlotStats[];
  byWeekday: SlotStats[];
  overallMedianPerHour: number;
  bestSlot: SlotStats | null;
  worstSlot: SlotStats | null;
  /** Monthly upside from moving one weekly shift from the worst to the best slot. */
  monthlyUpside: number;
  avgHoursPerShift: number;
}

function slotStats(label: string, rows: WorkerModel["earnings"]): SlotStats {
  const perHour = rows.map((e) => e.net_pay_cad / Math.max(1, e.hours_worked));
  return {
    label,
    shifts: rows.length,
    medianNetPerHour: median(perHour),
    medianNetPerShift: median(rows.map((e) => e.net_pay_cad)),
    tipShare:
      sum(rows.map((e) => e.gross_pay_cad)) > 0
        ? sum(rows.map((e) => e.tips_cad)) / sum(rows.map((e) => e.gross_pay_cad))
        : 0,
    sameDayPayShare: rows.length > 0 ? rows.filter((e) => e.paid_same_day === 1).length / rows.length : 0,
  };
}

export function computeShiftRoi(model: WorkerModel): ShiftRoi {
  const { earnings } = model;

  const byEmployer = [...groupBy(earnings, (e) => e.employer_id)]
    .map(([k, rows]) => slotStats(k, rows))
    .sort((a, b) => b.medianNetPerHour - a.medianNetPerHour);

  const byShiftType = [...groupBy(earnings, (e) => e.shift_type)]
    .map(([k, rows]) => slotStats(k, rows))
    .sort((a, b) => b.medianNetPerHour - a.medianNetPerHour);

  const byWeekday = [...groupBy(earnings, (e) => String(dayOfWeek(e.work_date)))]
    .map(([k, rows]) => slotStats(WEEKDAY_LABELS[Number(k)], rows))
    .sort(
      (a, b) => WEEKDAY_LABELS.indexOf(a.label) - WEEKDAY_LABELS.indexOf(b.label),
    );

  const overallMedianPerHour = median(
    earnings.map((e) => e.net_pay_cad / Math.max(1, e.hours_worked)),
  );

  // Only consider slots with enough evidence to act on.
  const credible = byWeekday.filter((s) => s.shifts >= 5);
  const ranked = [...credible].sort((a, b) => b.medianNetPerHour - a.medianNetPerHour);
  const bestSlot = ranked[0] ?? null;
  const worstSlot = ranked[ranked.length - 1] ?? null;
  const avgHoursPerShift = mean(earnings.map((e) => e.hours_worked));
  const monthlyUpside =
    bestSlot && worstSlot && bestSlot !== worstSlot
      ? (bestSlot.medianNetPerHour - worstSlot.medianNetPerHour) * avgHoursPerShift * 4
      : 0;

  return {
    byEmployer,
    byShiftType,
    byWeekday,
    overallMedianPerHour,
    bestSlot,
    worstSlot,
    monthlyUpside,
    avgHoursPerShift,
  };
}
