import type { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { clientFeedback } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { canViewConsultancy, isConsultancyMember } from "@/lib/consultancy/access";
import { clientFeedbackSchema } from "@/lib/validation/closure";
import { recordAuditEvent } from "@/lib/audit";

/** Feedback can be recorded once work is underway through to closure. */
const RECORDABLE_STATUSES = ["active", "delayed", "closure_requested", "completed_closed"];

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }
  const { id } = await params;
  const consultancy = await getConsultancyById(id);
  if (!consultancy || !(await canViewConsultancy(user, consultancy))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const rows = await db.select().from(clientFeedback).where(eq(clientFeedback.consultancyId, id)).orderBy(desc(clientFeedback.createdAt));
  return Response.json({ data: rows });
}

/** Screen 22 — records the client's feedback (overall satisfaction 1–5, comments, suggestions). */
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
  if (!RECORDABLE_STATUSES.includes(consultancy.status)) {
    return Response.json({ error: `Cannot record client feedback for a consultancy in status '${consultancy.status}'` }, { status: 409 });
  }
  if (!(await isConsultancyMember(user, consultancy))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = clientFeedbackSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [created] = await db
    .insert(clientFeedback)
    .values({ ...parsed.data, consultancyId: id, recordedBy: user.id })
    .returning();

  await recordAuditEvent({
    consultancyId: id,
    entityType: "client_feedback",
    entityId: created.id,
    action: "client_feedback_recorded",
    actorId: user.id,
    newValue: { rating: created.rating, feedbackDate: created.feedbackDate },
  });

  return Response.json({ data: created }, { status: 201 });
}
