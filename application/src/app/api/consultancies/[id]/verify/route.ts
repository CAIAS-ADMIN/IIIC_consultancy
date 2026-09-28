import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { consultancies, approvals, consultancyVersions } from "@/db/schema";
import type { Role } from "@/db/schema/enums";
import { getConsultancyById } from "@/db/queries/consultancies";
import { resolveApprovalChain, approvalChainInputFor } from "@/lib/consultancy/approval-chain";
import { assertWorkflowStage } from "@/lib/consultancy/workflow";
import { buildConsultancySnapshot } from "@/lib/consultancy/snapshot";
import { verifyStageSchema } from "@/lib/validation/verify";
import { recordAuditEvent } from "@/lib/audit";
import { notifyRole, notifyUser } from "@/lib/notifications";
import { FLAGGABLE_FIELD_NAMES } from "@/lib/consultancy/flaggable-fields";

const VERIFIABLE_STATUSES = ["submitted", "under_verification"] as const;

/**
 * verifyStage — the current workflow_stage's configured approver decides
 * verify / return-for-clarification / reject. Stage order and required
 * approver role come from `approval_stage_configs`, resolved fresh on every
 * call (never hardcoded), so a change to config takes effect immediately.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const existing = await getConsultancyById(id);
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!VERIFIABLE_STATUSES.includes(existing.status as (typeof VERIFIABLE_STATUSES)[number])) {
    return Response.json({ error: `Cannot verify a consultancy in status '${existing.status}'` }, { status: 409 });
  }

  const body = await request.json();
  const parsed = verifyStageSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (input.decision === "return") {
    const invalidFields = (input.flaggedFields ?? []).filter((f) => !FLAGGABLE_FIELD_NAMES.has(f));
    if (invalidFields.length > 0) {
      return Response.json(
        { error: `Not real consultancy fields, cannot be flagged: ${invalidFields.join(", ")}` },
        { status: 400 }
      );
    }
  }

  const chain = await resolveApprovalChain(db, approvalChainInputFor(existing));
  const currentIndex = chain.findIndex((s) => s.stage === existing.workflowStage);
  if (currentIndex === -1) {
    return Response.json(
      { error: `No configured approval stage matches the current workflow_stage '${existing.workflowStage}'` },
      { status: 409 }
    );
  }
  const currentStage = chain[currentIndex];

  const requiredRole = currentStage.approverRole as Role;
  // CAIAS admins may decide on any stage — e.g. return a submission for re-edit or reject it.
  const isAdmin = user.roles.includes("system_admin") || user.roles.includes("iiic_admin");
  if (!user.roles.includes(requiredRole) && !isAdmin) {
    return Response.json({ error: `Forbidden: requires role '${requiredRole}'` }, { status: 403 });
  }

  if (requiredRole === "hod" && !isAdmin && (!user.departmentId || existing.departmentId !== user.departmentId)) {
    return Response.json(
      { error: "Forbidden: HOD can only verify consultancies for their own department" },
      { status: 403 }
    );
  }

  const result = await db.transaction(async (tx) => {
    await tx.insert(approvals).values({
      consultancyId: id,
      stage: currentStage.stage,
      decision: input.decision,
      decidedBy: user.id,
      comments: input.comments ?? null,
    });

    if (input.decision === "verify") {
      const isLastStage = currentIndex === chain.length - 1;
      const [updated] = await tx
        .update(consultancies)
        .set(
          isLastStage
            ? {
                status: "registered",
                workflowStage: "verification_complete",
                registeredAt: new Date(),
                updatedAt: new Date(),
              }
            : {
                status: "under_verification",
                workflowStage: assertWorkflowStage(chain[currentIndex + 1].stage),
                updatedAt: new Date(),
              }
        )
        .where(eq(consultancies.id, id))
        .returning();

      await recordAuditEvent(
        {
          consultancyId: id,
          entityType: "consultancy",
          entityId: id,
          action: "verified",
          actorId: user.id,
          oldValue: { status: existing.status, workflowStage: existing.workflowStage },
          newValue: { status: updated.status, workflowStage: updated.workflowStage, stage: currentStage.stage },
          comments: input.comments,
        },
        tx
      );

      if (isLastStage) {
        await notifyUser(
          {
            userId: updated.facultyInChargeId,
            consultancyId: id,
            type: "registered",
            message: `Consultancy ${updated.consultancyCode} ("${updated.title}") has been registered.`,
          },
          tx
        );
        await notifyRole(
          {
            role: "finance",
            consultancyId: id,
            type: "new_registered",
            message: `New consultancy registered: ${updated.consultancyCode} ("${updated.title}").`,
          },
          tx
        );
      } else {
        await notifyUser(
          {
            userId: updated.facultyInChargeId,
            consultancyId: id,
            type: "stage_verified",
            message: `Registration ${updated.consultancyCode} passed ${currentStage.stage.replace(/_pending$/, "").replace(/_/g, " ")} and moved to the next stage.`,
          },
          tx
        );
        await notifyRole(
          {
            role: chain[currentIndex + 1].approverRole as Role,
            departmentId: updated.departmentId,
            consultancyId: id,
            type: "verification_pending",
            message: `Consultancy ${updated.consultancyCode} ("${updated.title}") is awaiting your verification.`,
          },
          tx
        );
      }

      return updated;
    }

    if (input.decision === "reject") {
      const [updated] = await tx
        .update(consultancies)
        .set({ status: "rejected", workflowStage: "none", updatedAt: new Date() })
        .where(eq(consultancies.id, id))
        .returning();

      await recordAuditEvent(
        {
          consultancyId: id,
          entityType: "consultancy",
          entityId: id,
          action: "rejected",
          actorId: user.id,
          oldValue: { status: existing.status },
          newValue: { status: updated.status, stage: currentStage.stage },
          comments: input.comments,
        },
        tx
      );

      await notifyUser(
        {
          userId: updated.facultyInChargeId,
          consultancyId: id,
          type: "rejected",
          message: `Consultancy ${updated.consultancyCode ?? updated.title} was rejected during verification.`,
        },
        tx
      );

      return updated;
    }

    // return for clarification: snapshot the pre-edit state before allowing any edits.
    const snapshot = await buildConsultancySnapshot(tx, id);
    await tx.insert(consultancyVersions).values({
      consultancyId: id,
      versionNumber: existing.currentVersion,
      snapshot,
      reason: input.comments ?? "Returned for clarification",
      createdBy: user.id,
    });

    const [updated] = await tx
      .update(consultancies)
      .set({
        status: "clarification_required",
        flaggedFields: input.flaggedFields ?? [],
        updatedAt: new Date(),
      })
      .where(eq(consultancies.id, id))
      .returning();

    await recordAuditEvent(
      {
        consultancyId: id,
        entityType: "consultancy",
        entityId: id,
        action: "returned_for_clarification",
        actorId: user.id,
        oldValue: { status: existing.status, currentVersion: existing.currentVersion },
        newValue: { status: updated.status, flaggedFields: updated.flaggedFields, stage: currentStage.stage },
        comments: input.comments,
      },
      tx
    );

    await notifyUser(
      {
        userId: updated.facultyInChargeId,
        consultancyId: id,
        type: "clarification_required",
        message: `Consultancy ${updated.consultancyCode ?? updated.title} was returned for clarification.`,
      },
      tx
    );

    return updated;
  });

  return Response.json({ data: result });
}
