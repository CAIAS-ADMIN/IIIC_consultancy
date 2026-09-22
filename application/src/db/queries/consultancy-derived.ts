import { and, eq, lt, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { milestones } from "@/db/schema";
import type { getConsultancyById } from "./consultancies";

type ConsultancyRow = NonNullable<Awaited<ReturnType<typeof getConsultancyById>>>;

/**
 * Statuses that can never be "overdue" — either they're already a terminal
 * outcome, or (Phase 8) the clock is deliberately paused: time spent
 * `on_hold` must not trigger a false Delayed/overdue flag.
 */
const NOT_OVERDUE_ELIGIBLE_STATUSES = ["completed_closed", "cancelled", "terminated", "rejected", "on_hold"];
const CLOSED_MILESTONE_STATUSES = ["completed", "cancelled"] as const;

function daysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

/**
 * Days elapsed/remaining, completion overdue-ness, and overdue milestones —
 * all computed on read (Phase 7), never stored as writable columns.
 */
export async function getConsultancyDerivedFields(consultancy: ConsultancyRow) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const daysElapsed = consultancy.activatedAt ? daysBetween(new Date(consultancy.activatedAt), now) : null;
  const daysRemaining = consultancy.currentCompletionDate
    ? daysBetween(now, new Date(`${consultancy.currentCompletionDate}T00:00:00Z`))
    : null;

  const isOverdueEligible = !NOT_OVERDUE_ELIGIBLE_STATUSES.includes(consultancy.status);

  const isCompletionOverdue =
    isOverdueEligible && consultancy.currentCompletionDate != null && consultancy.currentCompletionDate < today;

  const overdueMilestones = isOverdueEligible
    ? await db
        .select({ id: milestones.id, title: milestones.title, plannedDate: milestones.plannedDate, status: milestones.status })
        .from(milestones)
        .where(
          and(
            eq(milestones.consultancyId, consultancy.id),
            lt(milestones.plannedDate, today),
            notInArray(milestones.status, [...CLOSED_MILESTONE_STATUSES])
          )
        )
    : [];

  return {
    daysElapsed,
    daysRemaining,
    isCompletionOverdue,
    overdueMilestones,
  };
}
