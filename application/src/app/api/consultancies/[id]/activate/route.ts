import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { consultancies } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { checkActivationGates } from "@/lib/consultancy/activation";
import { recordAuditEvent } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";

/**
 * activateConsultancy — iiic_admin/system_admin only (the central admin
 * office activates, mirroring the same authority that owns CAIAS
 * Verification). Every gate is re-checked against real data, not just the
 * `registered` status flag.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const gate = await checkActivationGates(existing);
  if (!gate.ok) {
    return Response.json({ error: { code: "activation_blocked", reasons: gate.reasons } }, { status: 409 });
  }

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(consultancies)
      .set({ status: "active", activatedAt: new Date(), activatedBy: user.id, updatedAt: new Date() })
      .where(eq(consultancies.id, id))
      .returning();

    await recordAuditEvent(
      {
        consultancyId: id,
        entityType: "consultancy",
        entityId: id,
        action: "activated",
        actorId: user.id,
        oldValue: { status: existing.status },
        newValue: { status: updated.status, activatedAt: updated.activatedAt },
      },
      tx
    );

    await notifyUser(
      {
        userId: updated.createdBy,
        consultancyId: id,
        type: "activated",
        message: `Consultancy ${updated.consultancyCode} ("${updated.title}") is now active.`,
      },
      tx
    );

    return updated;
  });

  return Response.json({ data: result });
}
