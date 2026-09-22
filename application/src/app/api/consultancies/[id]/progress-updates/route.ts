import type { NextRequest } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { progressUpdates, documents } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { isConsultancyMember } from "@/lib/consultancy/access";
import { addProgressUpdateSchema } from "@/lib/validation/progress";
import { recordAuditEvent } from "@/lib/audit";

/** GET — status/progress-% history, chronological by report date. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const consultancy = await getConsultancyById(id);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(progressUpdates)
    .where(eq(progressUpdates.consultancyId, id))
    .orderBy(asc(progressUpdates.reportDate), asc(progressUpdates.createdAt));

  return Response.json({ data: rows });
}

/** addProgressUpdate — only on an `active` consultancy, by a team member or oversight role. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const consultancy = await getConsultancyById(id);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (consultancy.status !== "active") {
    return Response.json({ error: `Cannot record progress on a consultancy in status '${consultancy.status}'` }, { status: 409 });
  }
  if (!(await isConsultancyMember(user, consultancy))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = addProgressUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (input.documentIds.length > 0) {
    const owned = await db.query.documents.findMany({
      where: and(inArray(documents.id, input.documentIds), eq(documents.consultancyId, id)),
    });
    if (owned.length !== input.documentIds.length) {
      return Response.json({ error: "One or more documentIds do not belong to this consultancy" }, { status: 400 });
    }
  }

  const result = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(progressUpdates)
      .values({
        consultancyId: id,
        reportDate: input.reportDate,
        reportingPeriodStart: input.reportingPeriodStart,
        reportingPeriodEnd: input.reportingPeriodEnd,
        status: input.status,
        workCompleted: input.workCompleted,
        workInProgress: input.workInProgress,
        overallProgressPercent: input.overallProgressPercent,
        createdBy: user.id,
      })
      .returning();

    if (input.documentIds.length > 0) {
      await tx.update(documents).set({ progressUpdateId: created.id }).where(inArray(documents.id, input.documentIds));
    }

    await recordAuditEvent(
      {
        consultancyId: id,
        entityType: "progress_update",
        entityId: created.id,
        action: "progress_update_added",
        actorId: user.id,
        newValue: { status: created.status, overallProgressPercent: created.overallProgressPercent },
      },
      tx
    );

    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
