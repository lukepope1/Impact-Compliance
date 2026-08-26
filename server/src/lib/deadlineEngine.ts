/**
 * Turns a requirement_definition's cadence + due_rule into concrete requirement_instances.
 *
 * Scope note (from the schema's implementation notes): due_rule is JSON because terms
 * differ materially by deal — fixed dates, days after period end, days after filing,
 * extension logic, earlier/later-of compound rules, on-request SLAs. Phase 3 implements
 * the two rule types the pilot deals actually use (days_after_period_end, and fixed
 * annual dates) plus one_time and on_request. Anything else in due_rule.type is rejected
 * rather than silently guessed at — better to fail loud than generate a wrong due date.
 *
 * Periods are calendar-aligned (calendar quarter/half/year), matching what the
 * wireframes show ("Q2 2026", "CY 2026") — not the reporting party's fiscal year, which
 * a deal may set independently for narrative/financial purposes elsewhere.
 */

export interface Period {
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
}

export type DueRule =
  | { type: "days_after_period_end"; days: number }
  | { type: "fixed_dates"; dates: string[] } // "MM-DD"
  | { type: "on_request"; responseDays: number }
  | { type: "one_time"; dueDate?: string }; // ISO date; if absent, caller must supply one

function endOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, days: number) {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function calendarPeriods(cadence: string, rangeStart: Date, rangeEnd: Date): { periodStart: Date; periodEnd: Date }[] {
  const periods: { periodStart: Date; periodEnd: Date }[] = [];
  const startYear = rangeStart.getUTCFullYear();
  const endYear = rangeEnd.getUTCFullYear();

  const monthSpans: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };
  const span = monthSpans[cadence];
  if (!span) throw new Error(`calendarPeriods: unsupported cadence "${cadence}"`);

  for (let year = startYear; year <= endYear; year++) {
    for (let month = 0; month < 12; month += span) {
      const periodStart = new Date(Date.UTC(year, month, 1));
      const periodEnd = endOfDay(new Date(Date.UTC(year, month + span, 0)));
      if (periodEnd < rangeStart || periodStart > rangeEnd) continue;
      periods.push({ periodStart, periodEnd });
    }
  }
  return periods;
}

/** Generates every period+due-date pair a requirement should have an instance for, within [rangeStart, rangeEnd]. */
export function generatePeriods(cadence: string, dueRule: DueRule, rangeStart: Date, rangeEnd: Date): Period[] {
  if (cadence === "on_request") return [];

  if (cadence === "one_time") {
    if (dueRule.type !== "one_time") throw new Error("one_time cadence requires a one_time due_rule");
    const dueDate = dueRule.dueDate ? new Date(dueRule.dueDate) : rangeEnd;
    return [{ periodStart: rangeStart, periodEnd: rangeEnd, dueDate }];
  }

  if (dueRule.type === "fixed_dates") {
    const periods: Period[] = [];
    for (let year = rangeStart.getUTCFullYear(); year <= rangeEnd.getUTCFullYear(); year++) {
      for (const md of dueRule.dates) {
        const [month, day] = md.split("-").map(Number);
        const dueDate = new Date(Date.UTC(year, month - 1, day));
        if (dueDate < rangeStart || dueDate > rangeEnd) continue;
        periods.push({ periodStart: new Date(Date.UTC(year, 0, 1)), periodEnd: dueDate, dueDate });
      }
    }
    return periods;
  }

  if (dueRule.type === "days_after_period_end") {
    return calendarPeriods(cadence, rangeStart, rangeEnd).map((p) => ({
      ...p,
      dueDate: addDays(p.periodEnd, dueRule.days),
    }));
  }

  throw new Error(`generatePeriods: due_rule type "${dueRule.type}" not supported for cadence "${cadence}"`);
}

/** A requirement instance is overdue once its due date passes without reaching a terminal/submitted state. */
const OVERDUE_EXEMPT_STATUSES = new Set([
  "submitted",
  "impact_review",
  "impact_approved",
  "cde_review",
  "cde_approved",
  "amis_ready",
  "exported_filed",
  "closed",
  "waived",
]);

export function computeIsOverdue(dueDate: Date | null, status: string, asOf: Date): boolean {
  if (!dueDate) return false;
  if (OVERDUE_EXEMPT_STATUSES.has(status)) return false;
  return dueDate.getTime() < asOf.getTime();
}

const UPCOMING_WINDOW_DAYS = 30;

/** upcoming replaces not_due once the due date is within the reminder window; overdue takes priority. */
export function computeDisplayStatus(currentStatus: string, dueDate: Date | null, asOf: Date): string {
  if (currentStatus !== "not_due" && currentStatus !== "upcoming") return currentStatus;
  if (!dueDate) return currentStatus;
  if (dueDate.getTime() < asOf.getTime()) return currentStatus; // overdue is tracked via is_overdue, not a status value
  const daysUntilDue = (dueDate.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24);
  return daysUntilDue <= UPCOMING_WINDOW_DAYS ? "upcoming" : "not_due";
}
