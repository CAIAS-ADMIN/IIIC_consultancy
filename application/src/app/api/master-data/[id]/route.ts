import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { masterData } from "@/db/schema";
import { getMasterDataById } from "@/db/queries/master-data";
import { updateMasterDataSchema } from "@/lib/validation/master-data";
import { recordAuditEvent } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireRole("system_admin");
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const existing = await getMasterDataById(id);
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateMasterDataSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [updated] = await db
    .update(masterData)
    .set({ ...parsed.data, updatedBy: user.id, updatedAt: new Date() })
    .where(eq(masterData.id, id))
    .returning();

  await recordAuditEvent({
    entityType: "master_data",
    entityId: id,
    action: "updated",
    actorId: user.id,
    oldValue: existing,
    newValue: updated,
  });

  return Response.json({ data: updated });
}
