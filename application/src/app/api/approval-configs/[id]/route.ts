import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { approvalStageConfigs } from "@/db/schema";
import { APPROVAL_CONFIG_ROLES, approvalConfigSchema } from "@/lib/validation/approval-config";
import { recordAuditEvent } from "@/lib/audit";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireRole(...APPROVAL_CONFIG_ROLES);
  } catch (error) {
    return authErrorResponse(error);
  }
  const { id } = await params;
  const existing = await db.query.approvalStageConfigs.findFirst({ where: eq(approvalStageConfigs.id, id) });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = approvalConfigSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const [updated] = await db
    .update(approvalStageConfigs)
    .set({
      departmentId: null,
      consultancyAreaCode: null,
      consultancyCategoryCode: null,
      minValue: null,
      maxValue: null,
      whenResourcesUsed: null,
      whenIpOrConfidential: null,
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(approvalStageConfigs.id, id))
    .returning();

  await recordAuditEvent({ entityType: "approval_config", entityId: id, action: "updated", actorId: user.id, oldValue: existing, newValue: updated });
  return Response.json({ data: updated });
}

/**
 * Removing a rule is safe for in-flight records: a consultancy sitting at a
 * stage whose rule is deleted is re-resolved on its next decision. The
 * deletion is audited like every other configuration change.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireRole(...APPROVAL_CONFIG_ROLES);
  } catch (error) {
    return authErrorResponse(error);
  }
  const { id } = await params;
  const existing = await db.query.approvalStageConfigs.findFirst({ where: eq(approvalStageConfigs.id, id) });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  await db.delete(approvalStageConfigs).where(eq(approvalStageConfigs.id, id));
  await recordAuditEvent({ entityType: "approval_config", entityId: id, action: "deleted", actorId: user.id, oldValue: existing });
  return Response.json({ data: { id } });
}
