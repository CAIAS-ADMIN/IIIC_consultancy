import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { consultancies, consultancyVersions } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { buildConsultancySnapshot } from "@/lib/consultancy/snapshot";
import { recordAuditEvent } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";
import { SEND_BACK_STATUSES, sendBackConsultancySchema } from "@/lib/validation/lifecycle";

/**
 * CAIAS admin: send a submitted registration back to `draft` for a full
 * re-edit — every wizard section unlocked, not just flagged fields as the
 * "return for clarification" decision allows. The pre-edit state is
 * snapshotted as a version, the Consultancy ID is kept (submit reuses it),
 * and the faculty-in-charge is told why. The admin can equally make the
 * corrections themselves before re-submitting.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireRole("iiic_admin", "system_admin");
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const existing = await getConsultancyById(id);
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!SEND_BACK_STATUSES.includes(existing.status as (typeof SEND_BACK_STATUSES)[number])) {
    return Response.json(
      { error: `Only a submitted registration awaiting verification can be sent back (this one is "${existing.status}")` },
      { status: 409 }
    );
  }

  const parsed = sendBackConsultancySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { reason } = parsed.data;

  const updated = await db.transaction(async (tx) => {
    const snapshot = await buildConsultancySnapshot(tx, id);
    await tx.insert(consultancyVersions).values({
      consultancyId: id,
      versionNumber: existing.currentVersion,
      snapshot,
      reason: `Sent back for re-edit: ${reason}`,
      createdBy: user.id,
    });

    const [row] = await tx
      .update(consultancies)
      .set({
        status: "draft",
        workflowStage: "none",
        isLocked: false,
        flaggedFields: null,
        currentVersion: existing.currentVersion + 1,
        updatedAt: new Date(),
      })
      .where(eq(consultancies.id, id))
      .returning();

    await recordAuditEvent(
      {
        consultancyId: id,
        entityType: "consultancy",
        entityId: id,
        action: "sent_back_for_re_edit",
        actorId: user.id,
        oldValue: { status: existing.status, workflowStage: existing.workflowStage },
        newValue: { status: row.status, workflowStage: row.workflowStage },
        comments: reason,
      },
      tx
    );

    const label = existing.consultancyCode ?? `"${existing.title}"`;
    const message = `Consultancy ${label} was sent back to draft for re-editing: ${reason}`;
    const recipients = new Set([existing.facultyInChargeId, existing.createdBy]);
    recipients.delete(user.id);
    for (const userId of recipients) {
      await notifyUser({ userId, consultancyId: id, type: "sent_back_for_re_edit", message }, tx);
    }

    return row;
  });

  return Response.json({ data: updated });
}
