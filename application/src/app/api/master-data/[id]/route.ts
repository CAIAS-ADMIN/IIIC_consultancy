import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { masterData } from "@/db/schema";
import { getMasterDataById, getMasterDataUsage } from "@/db/queries/master-data";
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

/**
 * DELETE /api/master-data/:id — only for a value nothing uses yet (e.g. one
 * added by mistake). A value already stored on consultancies, clients,
 * agreements, team members, documents or approval settings is refused with
 * where it's used; deactivate it instead, which hides it from new forms
 * without breaking existing records.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const usage = await getMasterDataUsage(existing);
  if (usage.length > 0) {
    const where = usage.map((u) => `${u.count} ${u.where}`).join(", ");
    return Response.json(
      { error: `"${existing.label}" is in use (${where}), so it can't be deleted. Deactivate it instead — it will no longer be offered in forms.`, usage },
      { status: 409 }
    );
  }

  await db.delete(masterData).where(eq(masterData.id, id));
  await recordAuditEvent({
    entityType: "master_data",
    entityId: id,
    action: "deleted",
    actorId: user.id,
    oldValue: existing,
  });

  return Response.json({ data: { id } });
}
