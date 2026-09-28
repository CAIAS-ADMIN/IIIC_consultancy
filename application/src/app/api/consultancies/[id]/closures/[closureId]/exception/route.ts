import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { closures, closureExceptions } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { isOutOfDepartmentHod } from "@/lib/consultancy/access";
import { closureExceptionSchema } from "@/lib/validation/closure";
import { recordAuditEvent } from "@/lib/audit";

/**
 * authorised_exception — lets closure proceed with an unpaid balance.
 * Financial sign-off could plausibly come from Finance or from an oversight
 * role acting as "authorising officer" (the plan names both concepts
 * without pinning down which); both are allowed here.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; closureId: string }> }
) {
  let user;
  try {
    user = await requireRole("finance", "hod", "iiic_admin", "competent_authority", "system_admin");
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id, closureId } = await params;
  const consultancy = await getConsultancyById(id);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (isOutOfDepartmentHod(user, consultancy)) {
    return Response.json({ error: "Forbidden: HOD can only act on consultancies of their own department" }, { status: 403 });
  }

  const closure = await db.query.closures.findFirst({ where: eq(closures.id, closureId) });
  if (!closure || closure.consultancyId !== id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (closure.status !== "requested") {
    return Response.json({ error: `Cannot add an exception to a closure in status '${closure.status}'` }, { status: 409 });
  }

  const body = await request.json();
  const parsed = closureExceptionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [created] = await db
    .insert(closureExceptions)
    .values({ ...parsed.data, closureId, authorisingOfficerId: user.id })
    .returning();

  await recordAuditEvent({
    consultancyId: id,
    entityType: "closure_exception",
    entityId: created.id,
    action: "closure_exception_authorised",
    actorId: user.id,
    newValue: { amountOutstanding: created.amountOutstanding, reason: created.reason },
  });

  return Response.json({ data: created }, { status: 201 });
}
