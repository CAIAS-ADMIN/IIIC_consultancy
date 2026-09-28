import type { NextRequest } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { requireRole } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { holds, consultancies } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { isOutOfDepartmentHod } from "@/lib/consultancy/access";
import { recordAuditEvent } from "@/lib/audit";

/** resumeFromHold — closes the open hold row; does not extend completion dates or mark the paused time as Delayed. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireRole("hod", "iiic_admin", "system_admin");
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
  if (consultancy.status !== "on_hold") {
    return Response.json({ error: `Consultancy is not on hold (status '${consultancy.status}')` }, { status: 409 });
  }

  const openHold = await db.query.holds.findFirst({
    where: and(eq(holds.consultancyId, id), isNull(holds.actualResumeDate)),
    orderBy: desc(holds.createdAt),
  });
  if (!openHold) {
    return Response.json({ error: "No open hold record found for this consultancy" }, { status: 409 });
  }

  const result = await db.transaction(async (tx) => {
    const [updatedHold] = await tx
      .update(holds)
      .set({ actualResumeDate: new Date().toISOString().slice(0, 10) })
      .where(eq(holds.id, openHold.id))
      .returning();

    const [updatedConsultancy] = await tx
      .update(consultancies)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(consultancies.id, id))
      .returning();

    await recordAuditEvent(
      {
        consultancyId: id,
        entityType: "hold",
        entityId: openHold.id,
        action: "resumed_from_hold",
        actorId: user.id,
        oldValue: { status: consultancy.status },
        newValue: { status: updatedConsultancy.status, actualResumeDate: updatedHold.actualResumeDate },
      },
      tx
    );

    return { hold: updatedHold, consultancy: updatedConsultancy };
  });

  return Response.json({ data: result });
}
