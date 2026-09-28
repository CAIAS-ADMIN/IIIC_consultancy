import type { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { approvals, consultancies, documents, reopenings } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { approvalChainInputFor, resolveApprovalChain } from "@/lib/consultancy/approval-chain";
import { assertWorkflowStage } from "@/lib/consultancy/workflow";
import { reopenConsultancySchema } from "@/lib/validation/lifecycle";
import { recordAuditEvent } from "@/lib/audit";
import { notifyRole, notifyUser } from "@/lib/notifications";
import type { Role } from "@/db/schema/enums";

/**
 * Section 51.3 — a rejected or closed record is never silently reopened; this
 * explicit, audited action records who, why, when, and previous → new status.
 *  - rejected → under_verification, back at the stage that rejected it, so
 *    that verifier decides again (and can return specific fields for
 *    clarification in the usual way).
 *  - completed_closed → active, so work/closure can resume; the earlier
 *    closure and its record stay in history.
 * The Consultancy ID never changes.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireRole("iiic_admin", "system_admin");
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const consultancy = await getConsultancyById(id);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (consultancy.status !== "rejected" && consultancy.status !== "completed_closed") {
    return Response.json({ error: `Only rejected or closed records can be reopened (this one is "${consultancy.status}")` }, { status: 409 });
  }
  if (consultancy.archivedAt) {
    return Response.json({ error: "Restore this record from the archive before reopening it" }, { status: 409 });
  }

  const parsed = reopenConsultancySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  if (input.supportingDocumentId) {
    const doc = await db.query.documents.findFirst({ where: eq(documents.id, input.supportingDocumentId) });
    if (!doc || doc.consultancyId !== id) {
      return Response.json({ error: "The supporting document must belong to this consultancy" }, { status: 400 });
    }
  }

  const result = await db.transaction(async (tx) => {
    let patch: Partial<typeof consultancies.$inferInsert>;
    let nextApprover: Role | null = null;
    if (consultancy.status === "rejected") {
      const lastReject = await tx.query.approvals.findFirst({
        where: and(eq(approvals.consultancyId, id), eq(approvals.decision, "reject")),
        orderBy: [desc(approvals.decidedAt)],
      });
      const chain = await resolveApprovalChain(tx, approvalChainInputFor(consultancy));
      const stage = chain.find((s) => s.stage === lastReject?.stage) ?? chain[0];
      if (!stage) {
        throw new ReopenError("No verification stage is configured for this consultancy — add one in Approval Settings first");
      }
      nextApprover = stage.approverRole as Role;
      patch = { status: "under_verification", workflowStage: assertWorkflowStage(stage.stage), flaggedFields: null };
    } else {
      patch = { status: "active", actualCompletionDate: null };
    }

    const [updated] = await tx
      .update(consultancies)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(consultancies.id, id))
      .returning();

    const [reopening] = await tx
      .insert(reopenings)
      .values({
        consultancyId: id,
        previousStatus: consultancy.status,
        newStatus: updated.status,
        reason: input.reason,
        supportingDocumentId: input.supportingDocumentId ?? null,
        authorisedBy: user.id,
      })
      .returning();

    await recordAuditEvent(
      {
        consultancyId: id,
        entityType: "consultancy",
        entityId: id,
        action: "reopened",
        actorId: user.id,
        oldValue: { status: consultancy.status },
        newValue: { status: updated.status, workflowStage: updated.workflowStage, reopeningId: reopening.id },
        comments: input.reason,
      },
      tx
    );

    await notifyUser(
      {
        userId: consultancy.facultyInChargeId,
        consultancyId: id,
        type: "reopened",
        message:
          updated.status === "under_verification"
            ? `Consultancy ${consultancy.consultancyCode} was reopened and is back under verification: ${input.reason}`
            : `Consultancy ${consultancy.consultancyCode} was reopened and is active again: ${input.reason}`,
      },
      tx
    );
    if (nextApprover) {
      await notifyRole(
        {
          role: nextApprover,
          departmentId: consultancy.departmentId,
          consultancyId: id,
          type: "verification_pending",
          message: `Reopened consultancy ${consultancy.consultancyCode} ("${consultancy.title}") is awaiting your verification.`,
        },
        tx
      );
    }
    return updated;
  }).catch((error) => {
    if (error instanceof ReopenError) return error;
    throw error;
  });

  if (result instanceof ReopenError) {
    return Response.json({ error: result.message }, { status: 409 });
  }
  return Response.json({ data: result });
}

class ReopenError extends Error {}
