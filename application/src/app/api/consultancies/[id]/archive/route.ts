import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { consultancies } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { ARCHIVABLE_STATUSES, archiveConsultancySchema } from "@/lib/validation/lifecycle";
import { recordAuditEvent } from "@/lib/audit";

/**
 * Section 68 — moves a finished record to the Archived logical state. Only
 * a flag: the ID, audit trail, financial records and documents are untouched
 * and remain fully readable; archived records just drop out of the default
 * working lists. DELETE restores it.
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
  if (!consultancy) return Response.json({ error: "Not found" }, { status: 404 });
  if (!(ARCHIVABLE_STATUSES as readonly string[]).includes(consultancy.status)) {
    return Response.json(
      { error: `Only closed, cancelled, terminated or rejected records can be archived (this one is "${consultancy.status}")` },
      { status: 409 }
    );
  }
  if (consultancy.archivedAt) return Response.json({ error: "This record is already archived" }, { status: 409 });

  const parsed = archiveConsultancySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db
    .update(consultancies)
    .set({ archivedAt: new Date(), archivedBy: user.id, archiveReason: parsed.data.reason, updatedAt: new Date() })
    .where(eq(consultancies.id, id))
    .returning();
  await recordAuditEvent({
    consultancyId: id,
    entityType: "consultancy",
    entityId: id,
    action: "archived",
    actorId: user.id,
    oldValue: { archivedAt: null },
    newValue: { archivedAt: updated.archivedAt },
    comments: parsed.data.reason,
  });
  return Response.json({ data: updated });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireRole("iiic_admin", "system_admin");
  } catch (error) {
    return authErrorResponse(error);
  }
  const { id } = await params;
  const consultancy = await getConsultancyById(id);
  if (!consultancy) return Response.json({ error: "Not found" }, { status: 404 });
  if (!consultancy.archivedAt) return Response.json({ error: "This record is not archived" }, { status: 409 });

  const [updated] = await db
    .update(consultancies)
    .set({ archivedAt: null, archivedBy: null, archiveReason: null, updatedAt: new Date() })
    .where(eq(consultancies.id, id))
    .returning();
  await recordAuditEvent({
    consultancyId: id,
    entityType: "consultancy",
    entityId: id,
    action: "unarchived",
    actorId: user.id,
    oldValue: { archivedAt: consultancy.archivedAt, archiveReason: consultancy.archiveReason },
    newValue: { archivedAt: null },
  });
  return Response.json({ data: updated });
}
