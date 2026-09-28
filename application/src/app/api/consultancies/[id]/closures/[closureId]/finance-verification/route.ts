import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { closures } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { getFinancialSummary } from "@/lib/consultancy/financials";
import { financeClosureVerificationSchema } from "@/lib/validation/closure";
import { recordAuditEvent } from "@/lib/audit";
import { notifyRole } from "@/lib/notifications";

/**
 * Screen 23 "Finance Confirmation" — Finance verifies (or flags a
 * discrepancy in) the financial position of a pending closure. Finance-only,
 * like every other payment write. The closure gate requires `verified`
 * before CAIAS can mark the consultancy Completed & Closed (spec §27, §57).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; closureId: string }> }) {
  let user;
  try {
    user = await requireRole("finance");
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id, closureId } = await params;
  const consultancy = await getConsultancyById(id);
  const closure = await db.query.closures.findFirst({ where: eq(closures.id, closureId) });
  if (!consultancy || !closure || closure.consultancyId !== id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (closure.status !== "requested") {
    return Response.json({ error: `This closure has already been decided ('${closure.status}')` }, { status: 409 });
  }

  const parsed = financeClosureVerificationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const summary = await getFinancialSummary(consultancy);

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(closures)
      .set({
        financeVerificationStatus: input.status,
        financeRemarks: input.remarks ?? null,
        financeVerifiedBy: user.id,
        financeVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(closures.id, closureId))
      .returning();

    await recordAuditEvent(
      {
        consultancyId: id,
        entityType: "closure",
        entityId: closureId,
        action: input.status === "verified" ? "finance_verified" : "finance_discrepancy",
        actorId: user.id,
        oldValue: { financeVerificationStatus: closure.financeVerificationStatus },
        newValue: {
          financeVerificationStatus: input.status,
          totalValue: summary.totalValue,
          totalReceived: summary.totalReceived,
          balance: summary.amountPending,
        },
        comments: input.remarks ?? null,
      },
      tx
    );

    await notifyRole(
      {
        role: "iiic_admin",
        consultancyId: id,
        type: "financial_closure_confirmed",
        message:
          input.status === "verified"
            ? `Finance verified the financial position of ${consultancy.consultancyCode} for closure.`
            : `Finance flagged a discrepancy on ${consultancy.consultancyCode}'s closure: ${input.remarks}`,
      },
      tx
    );
    return row;
  });

  return Response.json({ data: updated });
}
