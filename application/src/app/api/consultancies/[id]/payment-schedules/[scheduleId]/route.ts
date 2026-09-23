import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { paymentSchedules } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { updatePaymentScheduleSchema } from "@/lib/validation/payments";
import { recordAuditEvent } from "@/lib/audit";

/**
 * updatePaymentSchedule — edits a planned stage/amount/date row. `finance`-only,
 * same exclusive gate as creating one (no oversight-role override, matching
 * every other payment-write route in this codebase). The frontend build
 * plan's Phase 8 literally asks for "add/edit rows"; only "add" existed
 * until this route, added alongside the Phase 8 UI that needed it.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scheduleId: string }> }
) {
  let user;
  try {
    user = await requireRole("finance");
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id, scheduleId } = await params;
  const consultancy = await getConsultancyById(id);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await db.query.paymentSchedules.findFirst({ where: eq(paymentSchedules.id, scheduleId) });
  if (!existing || existing.consultancyId !== id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updatePaymentScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [updated] = await db
    .update(paymentSchedules)
    .set(parsed.data)
    .where(eq(paymentSchedules.id, scheduleId))
    .returning();

  await recordAuditEvent({
    consultancyId: id,
    entityType: "payment_schedule",
    entityId: scheduleId,
    action: "payment_schedule_updated",
    actorId: user.id,
    oldValue: { stageLabel: existing.stageLabel, plannedAmount: existing.plannedAmount, plannedDate: existing.plannedDate },
    newValue: { stageLabel: updated.stageLabel, plannedAmount: updated.plannedAmount, plannedDate: updated.plannedDate },
  });

  return Response.json({ data: updated });
}
