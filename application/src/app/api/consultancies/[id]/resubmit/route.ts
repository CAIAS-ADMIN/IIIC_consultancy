import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { consultancies } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { recordAuditEvent } from "@/lib/audit";

/**
 * resubmitConsultancy — after the originating faculty has edited the flagged
 * fields (via PATCH), this re-enters the verification chain at the stage
 * that returned it (workflow_stage is left untouched by the return), not
 * necessarily from the start.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  if (existing.status !== "clarification_required") {
    return Response.json(
      { error: `Cannot resubmit a consultancy in status '${existing.status}'` },
      { status: 409 }
    );
  }
  if (existing.createdBy !== user.id && existing.facultyInChargeId !== user.id && !user.roles.includes("system_admin")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(consultancies)
      .set({
        status: "under_verification",
        currentVersion: existing.currentVersion + 1,
        flaggedFields: null,
        updatedAt: new Date(),
      })
      .where(eq(consultancies.id, id))
      .returning();

    await recordAuditEvent(
      {
        consultancyId: id,
        entityType: "consultancy",
        entityId: id,
        action: "resubmitted",
        actorId: user.id,
        oldValue: { status: existing.status, currentVersion: existing.currentVersion },
        newValue: { status: updated.status, currentVersion: updated.currentVersion, workflowStage: updated.workflowStage },
      },
      tx
    );

    return updated;
  });

  return Response.json({ data: result });
}
