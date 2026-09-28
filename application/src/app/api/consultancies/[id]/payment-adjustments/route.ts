import type { NextRequest } from "next/server";
import { canViewConsultancy } from "@/lib/consultancy/access";
import { desc, eq } from "drizzle-orm";
import { requireRole, requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { paymentAdjustments } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { createPaymentAdjustmentSchema } from "@/lib/validation/payments";
import { recordAuditEvent } from "@/lib/audit";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let viewer;
  try {
    viewer = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const consultancy = await getConsultancyById(id);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await canViewConsultancy(viewer, consultancy))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db.select().from(paymentAdjustments).where(eq(paymentAdjustments.consultancyId, id)).orderBy(desc(paymentAdjustments.createdAt));
  return Response.json({ data: rows });
}

/** `authorised_adjustment` — `finance`-only; raises the overpayment ceiling checked by `recordPaymentTransaction`. */
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
  const parsed = createPaymentAdjustmentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [created] = await db
    .insert(paymentAdjustments)
    .values({ ...parsed.data, consultancyId: id, authorisedBy: user.id })
    .returning();

  await recordAuditEvent({
    consultancyId: id,
    entityType: "payment_adjustment",
    entityId: created.id,
    action: "payment_adjustment_authorised",
    actorId: user.id,
    newValue: { amount: created.amount, reason: created.reason },
  });

  return Response.json({ data: created }, { status: 201 });
}
