import type { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { requireRole, requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { paymentSchedules } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { createPaymentScheduleSchema } from "@/lib/validation/payments";
import { recordAuditEvent } from "@/lib/audit";

/** Faculty-facing read: planned payment stages/amounts. */
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

  const rows = await db.select().from(paymentSchedules).where(eq(paymentSchedules.consultancyId, id)).orderBy(asc(paymentSchedules.plannedDate));
  return Response.json({ data: rows });
}

/** `finance`-only write, per "Finance role has exclusive write access to payment records." */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireRole("finance");
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const consultancy = await getConsultancyById(id);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = createPaymentScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [created] = await db
    .insert(paymentSchedules)
    .values({ ...parsed.data, consultancyId: id })
    .returning();

  await recordAuditEvent({
    consultancyId: id,
    entityType: "payment_schedule",
    entityId: created.id,
    action: "payment_schedule_created",
    actorId: user.id,
    newValue: created,
  });

  return Response.json({ data: created }, { status: 201 });
}
