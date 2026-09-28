import type { NextRequest } from "next/server";
import { canViewConsultancy } from "@/lib/consultancy/access";
import { asc, eq } from "drizzle-orm";
import { requireRole, requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { paymentTransactions } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { checkOverpaymentCeiling } from "@/lib/consultancy/financials";
import { recordPaymentTransactionSchema } from "@/lib/validation/payments";
import { recordAuditEvent } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";

/** Faculty-facing read: actual received amounts (view-only, no write path exists for non-finance roles). */
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

  const rows = await db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.consultancyId, id))
    .orderBy(asc(paymentTransactions.transactionDate));
  return Response.json({ data: rows });
}

/** recordPaymentTransaction — `finance`-only; rejects the write if it would exceed the agreement value without a covering adjustment. */
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
  const parsed = recordPaymentTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const created = await db.transaction(async (tx) => {
      const ceilingCheck = await checkOverpaymentCeiling(tx, id, Number(input.amount));
      if (!ceilingCheck.ok) {
        throw new OverpaymentError(ceilingCheck.reason!);
      }

      const [row] = await tx
        .insert(paymentTransactions)
        .values({ ...input, consultancyId: id, recordedBy: user.id })
        .returning();

      await recordAuditEvent(
        {
          consultancyId: id,
          entityType: "payment_transaction",
          entityId: row.id,
          action: "payment_transaction_recorded",
          actorId: user.id,
          newValue: { amount: row.amount, transactionRef: row.transactionRef },
        },
        tx
      );

      await notifyUser(
        {
          userId: consultancy.facultyInChargeId,
          consultancyId: id,
          type: "payment_recorded",
          message: `Finance recorded a payment of ${Number(row.amount).toFixed(2)} on ${consultancy.consultancyCode} (${row.transactionDate}).`,
        },
        tx
      );

      return row;
    });

    return Response.json({ data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof OverpaymentError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

class OverpaymentError extends Error {}
