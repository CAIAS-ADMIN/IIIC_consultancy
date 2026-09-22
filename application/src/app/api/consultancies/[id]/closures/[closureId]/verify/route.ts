import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { closures, consultancies } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { checkClosureGates } from "@/lib/consultancy/closure-gates";
import { verifyClosureSchema } from "@/lib/validation/closure";
import { recordAuditEvent } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";

/**
 * verifyClosure — IIIC/admin only. On "verified", the full gate checklist is
 * re-run (not just trusted from the request-time final-report check); any
 * failing item blocks with a specific reason, per the plan — only then does
 * the consultancy flip to `completed_closed`. On clarification_required or
 * returned, the consultancy goes back to `active` so the team can fix things
 * and submit a fresh closure request.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; closureId: string }> }
) {
  let user;
  try {
    user = await requireRole("iiic_admin", "system_admin");
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id, closureId } = await params;
  const consultancy = await getConsultancyById(id);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const closure = await db.query.closures.findFirst({ where: eq(closures.id, closureId) });
  if (!closure || closure.consultancyId !== id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (closure.status !== "requested") {
    return Response.json({ error: `This closure has already been decided ('${closure.status}')` }, { status: 409 });
  }

  const body = await request.json();
  const parsed = verifyClosureSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (input.decision === "verified") {
    const gate = await checkClosureGates(consultancy, closure);
    if (!gate.ok) {
      return Response.json({ error: { code: "closure_blocked", reasons: gate.reasons } }, { status: 409 });
    }
  }

  const result = await db.transaction(async (tx) => {
    const [updatedClosure] = await tx
      .update(closures)
      .set({ status: input.decision, verifiedBy: user.id, verifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(closures.id, closureId))
      .returning();

    const [updatedConsultancy] = await tx
      .update(consultancies)
      .set(
        input.decision === "verified"
          ? { status: "completed_closed", actualCompletionDate: closure.actualCompletionDate, updatedAt: new Date() }
          : { status: "active", updatedAt: new Date() }
      )
      .where(eq(consultancies.id, id))
      .returning();

    await recordAuditEvent(
      {
        consultancyId: id,
        entityType: "closure",
        entityId: closureId,
        action: "closure_" + input.decision,
        actorId: user.id,
        oldValue: { status: closure.status },
        newValue: { status: updatedClosure.status, consultancyStatus: updatedConsultancy.status },
        comments: input.comments,
      },
      tx
    );

    const notificationCopy: Record<typeof input.decision, string> = {
      verified: `Consultancy ${updatedConsultancy.consultancyCode} ("${updatedConsultancy.title}") is now Completed & Closed.`,
      clarification_required: `Closure for consultancy ${updatedConsultancy.consultancyCode} needs clarification before it can proceed.`,
      returned: `Closure for consultancy ${updatedConsultancy.consultancyCode} was returned for correction.`,
    };
    await notifyUser(
      {
        userId: closure.requestedBy,
        consultancyId: id,
        type: "closure_" + input.decision,
        message: notificationCopy[input.decision],
      },
      tx
    );

    return { closure: updatedClosure, consultancy: updatedConsultancy };
  });

  return Response.json({ data: result });
}
