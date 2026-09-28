import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { cancellations, consultancies } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { isOutOfDepartmentHod } from "@/lib/consultancy/access";
import { cancelConsultancySchema } from "@/lib/validation/lifecycle";
import { recordAuditEvent } from "@/lib/audit";

const TERMINAL_STATUSES = ["cancelled", "terminated", "completed_closed", "rejected", "draft"] as const;

/**
 * cancelConsultancy — distinct from closure (Phase 10) and from
 * `terminate` (below): this is "called off", not "wound down after partial
 * delivery". Only an oversight role can act, which doubles as the "approval
 * if required" gate the plan calls for — there's no separate two-step
 * request/decide flow here the way there is for extensions.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireRole("hod", "iiic_admin", "competent_authority", "system_admin");
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const consultancy = await getConsultancyById(id);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (isOutOfDepartmentHod(user, consultancy)) {
    return Response.json({ error: "Forbidden: HOD can only act on consultancies of their own department" }, { status: 403 });
  }
  if (TERMINAL_STATUSES.includes(consultancy.status as (typeof TERMINAL_STATUSES)[number])) {
    return Response.json({ error: `Cannot cancel a consultancy in status '${consultancy.status}'` }, { status: 409 });
  }

  const body = await request.json();
  const parsed = cancelConsultancySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(cancellations)
      .values({
        consultancyId: id,
        reason: input.reason,
        date: input.date,
        initiatedBy: user.id,
        financialStatus: input.financialStatus,
        outstandingObligations: input.outstandingObligations,
        approvedBy: user.id,
      })
      .returning();

    const [updated] = await tx
      .update(consultancies)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(consultancies.id, id))
      .returning();

    await recordAuditEvent(
      {
        consultancyId: id,
        entityType: "cancellation",
        entityId: created.id,
        action: "cancelled",
        actorId: user.id,
        oldValue: { status: consultancy.status },
        newValue: { status: updated.status, reason: created.reason },
      },
      tx
    );

    return { cancellation: created, consultancy: updated };
  });

  return Response.json({ data: result }, { status: 201 });
}
