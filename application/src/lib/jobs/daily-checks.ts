import { eq } from "drizzle-orm";
import { db } from "@/db";
import { consultancies, closures } from "@/db/schema";
import { getFinancialSummary } from "@/lib/consultancy/financials";
import { notifyUser, notifyRole } from "@/lib/notifications";
import { recordAuditEvent } from "@/lib/audit";

const THIRTY_DAYS_OUT_WINDOW = 30;

function daysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

type FlaggedConsultancy = { consultancyId: string; consultancyCode: string | null };

export type DailyChecksSummary = {
  thirtyDaysOut: FlaggedConsultancy[];
  completionDateReached: FlaggedConsultancy[];
  autoTransitionedToDelayed: FlaggedConsultancy[];
  missingPayment: FlaggedConsultancy[];
  missingClosure: FlaggedConsultancy[];
};

/**
 * The daily check sweep (Phase 11). Runs against real data every time it's
 * invoked — no state is cached between runs, so a consultancy is only ever
 * flagged for what's true *right now*. "No extension on record" for the
 * Delayed auto-transition falls out naturally from scoping to
 * `status = 'active'`: an approved extension already moved
 * `currentCompletionDate` forward, and a pending one moves `status` away
 * from `active` entirely (Phase 8), so neither case reaches this check.
 */
export async function runDailyChecks(): Promise<DailyChecksSummary> {
  const summary: DailyChecksSummary = {
    thirtyDaysOut: [],
    completionDateReached: [],
    autoTransitionedToDelayed: [],
    missingPayment: [],
    missingClosure: [],
  };

  const today = new Date();

  const activeConsultancies = await db.select().from(consultancies).where(eq(consultancies.status, "active"));

  for (const consultancy of activeConsultancies) {
    if (!consultancy.currentCompletionDate) continue;
    const flagged: FlaggedConsultancy = { consultancyId: consultancy.id, consultancyCode: consultancy.consultancyCode };
    const daysRemaining = daysBetween(today, new Date(`${consultancy.currentCompletionDate}T00:00:00Z`));

    if (daysRemaining === THIRTY_DAYS_OUT_WINDOW) {
      summary.thirtyDaysOut.push(flagged);
      await notifyUser({
        userId: consultancy.facultyInChargeId,
        consultancyId: consultancy.id,
        type: "completion_30_days_out",
        message: `Consultancy ${consultancy.consultancyCode} ("${consultancy.title}") is due for completion in 30 days.`,
      });
    } else if (daysRemaining === 0) {
      summary.completionDateReached.push(flagged);
      await notifyUser({
        userId: consultancy.facultyInChargeId,
        consultancyId: consultancy.id,
        type: "completion_date_reached",
        message: `Consultancy ${consultancy.consultancyCode} ("${consultancy.title}") has reached its completion date today.`,
      });
    } else if (daysRemaining < 0) {
      await db.transaction(async (tx) => {
        await tx.update(consultancies).set({ status: "delayed", updatedAt: new Date() }).where(eq(consultancies.id, consultancy.id));
        await recordAuditEvent(
          {
            consultancyId: consultancy.id,
            entityType: "consultancy",
            entityId: consultancy.id,
            action: "auto_delayed",
            actorId: null,
            oldValue: { status: "active" },
            newValue: { status: "delayed", currentCompletionDate: consultancy.currentCompletionDate },
            comments: "Automatically flagged by the daily check job: completion date passed with no extension on record.",
          },
          tx
        );
        await notifyUser(
          {
            userId: consultancy.facultyInChargeId,
            consultancyId: consultancy.id,
            type: "auto_delayed",
            message: `Consultancy ${consultancy.consultancyCode} ("${consultancy.title}") is past its completion date and has been flagged Delayed.`,
          },
          tx
        );
        await notifyRole(
          {
            role: "hod",
            departmentId: consultancy.departmentId,
            consultancyId: consultancy.id,
            type: "auto_delayed",
            message: `Consultancy ${consultancy.consultancyCode} ("${consultancy.title}") is past its completion date and has been flagged Delayed.`,
          },
          tx
        );
      });
      summary.autoTransitionedToDelayed.push(flagged);
    }
  }

  // Missing payment / missing closure: every past-due consultancy is `delayed` by
  // this point in the run (including ones just auto-transitioned above), so a
  // fresh query for that status is the complete, non-overlapping set.
  const pastDueConsultancies = await db.select().from(consultancies).where(eq(consultancies.status, "delayed"));

  for (const consultancy of pastDueConsultancies) {
    const flagged: FlaggedConsultancy = { consultancyId: consultancy.id, consultancyCode: consultancy.consultancyCode };

    const financial = await getFinancialSummary(consultancy);
    if (financial.amountPending > 0) {
      summary.missingPayment.push(flagged);
      await notifyRole({
        role: "finance",
        consultancyId: consultancy.id,
        type: "missing_payment",
        message: `Consultancy ${consultancy.consultancyCode} ("${consultancy.title}") is past due with an outstanding balance of ${financial.amountPending.toFixed(2)}.`,
      });
    }

    const closureRows = await db.query.closures.findMany({ where: eq(closures.consultancyId, consultancy.id) });
    if (closureRows.length === 0) {
      summary.missingClosure.push(flagged);
      await notifyRole({
        role: "iiic_admin",
        consultancyId: consultancy.id,
        type: "missing_closure",
        message: `Consultancy ${consultancy.consultancyCode} ("${consultancy.title}") is past due with no closure requested yet.`,
      });
    }
  }

  return summary;
}
