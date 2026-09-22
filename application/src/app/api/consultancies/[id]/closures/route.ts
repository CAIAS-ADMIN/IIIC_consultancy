import type { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { closures, consultancies, documents } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { isConsultancyMember } from "@/lib/consultancy/access";
import { requestClosureSchema } from "@/lib/validation/closure";
import { recordAuditEvent } from "@/lib/audit";
import { notifyRole } from "@/lib/notifications";

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

  const rows = await db.select().from(closures).where(eq(closures.consultancyId, id)).orderBy(desc(closures.createdAt));
  return Response.json({ data: rows });
}

/** requestClosure — only from `active`; the final report is validated up front so its absence gives an immediate, specific error. */
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
    return Response.json({ error: `Cannot request closure for a consultancy in status '${consultancy.status}'` }, { status: 409 });
  }
  if (!(await isConsultancyMember(user, consultancy))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = requestClosureSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const pending = await db.query.closures.findFirst({
    where: and(eq(closures.consultancyId, id), eq(closures.status, "requested")),
  });
  if (pending) {
    return Response.json({ error: "A closure request is already pending for this consultancy" }, { status: 409 });
  }

  const finalReport = await db.query.documents.findFirst({ where: eq(documents.id, input.finalReportDocumentId) });
  if (!finalReport || finalReport.consultancyId !== id || finalReport.status !== "available") {
    return Response.json({ error: "Final report document is missing or not available — upload it before requesting closure" }, { status: 400 });
  }

  const result = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(closures)
      .values({
        consultancyId: id,
        requestedBy: user.id,
        actualCompletionDate: input.actualCompletionDate,
        deliverableCompletionStatus: input.deliverableCompletionStatus,
        partialReason: input.partialReason,
        finalOutcomes: input.finalOutcomes,
        finalReportDocumentId: input.finalReportDocumentId,
      })
      .returning();

    await tx.update(consultancies).set({ status: "closure_requested", updatedAt: new Date() }).where(eq(consultancies.id, id));

    await recordAuditEvent(
      {
        consultancyId: id,
        entityType: "closure",
        entityId: created.id,
        action: "closure_requested",
        actorId: user.id,
        newValue: { deliverableCompletionStatus: created.deliverableCompletionStatus },
      },
      tx
    );

    await notifyRole(
      {
        role: "iiic_admin",
        consultancyId: id,
        type: "closure_review_pending",
        message: `Consultancy ${consultancy.consultancyCode} ("${consultancy.title}") has requested closure and needs review.`,
      },
      tx
    );

    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
