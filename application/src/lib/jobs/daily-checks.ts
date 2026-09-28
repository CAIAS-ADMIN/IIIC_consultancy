import { and, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { consultancies, closures, documents, milestones, paymentSchedules } from "@/db/schema";
import { getFinancialSummary } from "@/lib/consultancy/financials";
import { notifyUser, notifyRole } from "@/lib/notifications";
import { recordAuditEvent } from "@/lib/audit";

const THIRTY_DAYS_OUT_WINDOW = 30;
/** Lead time for "milestone approaching" and "payment stage due" alerts. */
const APPROACHING_WINDOW = 7;
/** Required-document check runs once, this many days after activation. */
const MISSING_DOCUMENTS_AFTER_DAYS = 7;

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
  milestoneApproaching: FlaggedConsultancy[];
  milestoneOverdue: FlaggedConsultancy[];
  paymentStageDue: FlaggedConsultancy[];
  missingDocuments: FlaggedConsultancy[];
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
    milestoneApproaching: [],
    milestoneOverdue: [],
    paymentStageDue: [],
    missingDocuments: [],
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
        await notifyRole(
          {
            role: "iiic_admin",
            consultancyId: consultancy.id,
            type: "auto_delayed",
            message: `Delayed consultancy: ${consultancy.consultancyCode} ("${consultancy.title}") is past its completion date.`,
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

  await runMonitoringAlerts(today, summary);
  return summary;
}

/**
 * Portal spec §34 / §60 monitoring alerts. Each fires on an exact day
 * (N days before, or the first day overdue), so a daily run notifies once
 * per event rather than every day.
 */
async function runMonitoringAlerts(today: Date, summary: DailyChecksSummary) {
  const iso = (offsetDays: number) => new Date(today.getTime() + offsetDays * 86_400_000).toISOString().slice(0, 10);
  const inWindow = iso(APPROACHING_WINDOW);
  const firstOverdueDay = iso(-1);

  const running = await db.select().from(consultancies).where(inArray(consultancies.status, ["active", "delayed"]));
  if (running.length === 0) return;
  const byId = new Map(running.map((c) => [c.id, c]));
  const ids = [...byId.keys()];

  const [openMilestones, dueStages, docRows] = await Promise.all([
    db
      .select()
      .from(milestones)
      .where(
        and(
          inArray(milestones.consultancyId, ids),
          notInArray(milestones.status, ["completed", "cancelled"]),
          inArray(milestones.plannedDate, [inWindow, firstOverdueDay])
        )
      ),
    db
      .select()
      .from(paymentSchedules)
      .where(and(inArray(paymentSchedules.consultancyId, ids), eq(paymentSchedules.plannedDate, inWindow))),
    db
      .select({ consultancyId: documents.consultancyId, category: documents.documentCategory })
      .from(documents)
      .where(and(inArray(documents.consultancyId, ids), eq(documents.status, "available"))),
  ]);

  for (const m of openMilestones) {
    const c = byId.get(m.consultancyId)!;
    const flagged = { consultancyId: c.id, consultancyCode: c.consultancyCode };
    const approaching = m.plannedDate === inWindow;
    (approaching ? summary.milestoneApproaching : summary.milestoneOverdue).push(flagged);
    await notifyUser({
      userId: c.facultyInChargeId,
      consultancyId: c.id,
      type: approaching ? "milestone_approaching" : "milestone_overdue",
      message: approaching
        ? `Milestone "${m.title}" on ${c.consultancyCode} is due in ${APPROACHING_WINDOW} days (${m.plannedDate}).`
        : `Milestone "${m.title}" on ${c.consultancyCode} is overdue (planned ${m.plannedDate}).`,
    });
  }

  for (const stage of dueStages) {
    const c = byId.get(stage.consultancyId)!;
    summary.paymentStageDue.push({ consultancyId: c.id, consultancyCode: c.consultancyCode });
    await notifyRole({
      role: "finance",
      consultancyId: c.id,
      type: "payment_stage_due",
      message: `Payment stage "${stage.stageLabel}" (${Number(stage.plannedAmount).toFixed(2)}) on ${c.consultancyCode} is due on ${stage.plannedDate}.`,
    });
  }

  // Required conditional documents still missing a week after activation.
  const checkDay = iso(-MISSING_DOCUMENTS_AFTER_DAYS);
  for (const c of running) {
    if (!c.activatedAt || c.activatedAt.toISOString().slice(0, 10) !== checkDay) continue;
    const onFile = new Set(docRows.filter((d) => d.consultancyId === c.id).map((d) => d.category));
    const missing = [
      ...(c.ndaRequired && !onFile.has("NDA") ? ["NDA"] : []),
      ...(c.ipAgreementRequired && !onFile.has("IP Agreement") ? ["IP Agreement"] : []),
    ];
    if (missing.length === 0) continue;
    summary.missingDocuments.push({ consultancyId: c.id, consultancyCode: c.consultancyCode });
    await notifyRole({
      role: "iiic_admin",
      consultancyId: c.id,
      type: "missing_documents",
      message: `${c.consultancyCode} ("${c.title}") is still missing: ${missing.join(", ")}.`,
    });
  }
}
