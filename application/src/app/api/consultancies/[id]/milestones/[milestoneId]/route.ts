import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { milestones, documents } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { isConsultancyMember } from "@/lib/consultancy/access";
import { updateMilestoneSchema } from "@/lib/validation/milestones";
import { recordAuditEvent } from "@/lib/audit";

/** updateMilestone — planned/actual dates, status, responsible consultant, remarks, supporting evidence. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id, milestoneId } = await params;
  const consultancy = await getConsultancyById(id);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (consultancy.status !== "active") {
    return Response.json({ error: `Cannot update a milestone on a consultancy in status '${consultancy.status}'` }, { status: 409 });
  }
  if (!(await isConsultancyMember(user, consultancy))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const existingMilestone = await db.query.milestones.findFirst({
    where: eq(milestones.id, milestoneId),
  });
  if (!existingMilestone || existingMilestone.consultancyId !== id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateMilestoneSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (input.evidenceDocumentId) {
    const doc = await db.query.documents.findFirst({ where: eq(documents.id, input.evidenceDocumentId) });
    if (!doc || doc.consultancyId !== id) {
      return Response.json({ error: "evidenceDocumentId does not belong to this consultancy" }, { status: 400 });
    }
  }

  const [updated] = await db
    .update(milestones)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(milestones.id, milestoneId))
    .returning();

  await recordAuditEvent({
    consultancyId: id,
    entityType: "milestone",
    entityId: milestoneId,
    action: "milestone_updated",
    actorId: user.id,
    oldValue: { status: existingMilestone.status, actualStartDate: existingMilestone.actualStartDate, actualDate: existingMilestone.actualDate },
    newValue: { status: updated.status, actualStartDate: updated.actualStartDate, actualDate: updated.actualDate },
  });

  return Response.json({ data: updated });
}
