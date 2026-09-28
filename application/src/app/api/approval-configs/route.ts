import type { NextRequest } from "next/server";
import { asc } from "drizzle-orm";
import { requireRole } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { approvalStageConfigs } from "@/db/schema";
import { APPROVAL_CONFIG_ROLES, approvalConfigSchema } from "@/lib/validation/approval-config";
import { recordAuditEvent } from "@/lib/audit";

export async function GET() {
  try {
    await requireRole(...APPROVAL_CONFIG_ROLES, "audit_readonly");
  } catch (error) {
    return authErrorResponse(error);
  }
  const rows = await db.select().from(approvalStageConfigs).orderBy(asc(approvalStageConfigs.sequence));
  return Response.json({ data: rows });
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireRole(...APPROVAL_CONFIG_ROLES);
  } catch (error) {
    return authErrorResponse(error);
  }
  const parsed = approvalConfigSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const [created] = await db.insert(approvalStageConfigs).values(parsed.data).returning();

  // Spec §50: "The configuration itself must be audited."
  await recordAuditEvent({ entityType: "approval_config", entityId: created.id, action: "created", actorId: user.id, newValue: created });
  return Response.json({ data: created }, { status: 201 });
}
