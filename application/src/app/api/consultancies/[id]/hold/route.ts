import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { holds, consultancies } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { putOnHoldSchema } from "@/lib/validation/lifecycle";
import { recordAuditEvent } from "@/lib/audit";

/** putOnHold — an administrative decision, not a self-service one; only an oversight role can pause an active consultancy. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  if (consultancy.status !== "active") {
    return Response.json({ error: `Cannot put a consultancy in status '${consultancy.status}' on hold` }, { status: 409 });
  }

  const body = await request.json();
  const parsed = putOnHoldSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(holds)
      .values({
        consultancyId: id,
        reason: input.reason,
        startDate: input.startDate,
        expectedResumeDate: input.expectedResumeDate,
        authorisedBy: user.id,
      })
      .returning();

    const [updated] = await tx
      .update(consultancies)
      .set({ status: "on_hold", updatedAt: new Date() })
      .where(eq(consultancies.id, id))
      .returning();

    await recordAuditEvent(
      {
        consultancyId: id,
        entityType: "hold",
        entityId: created.id,
        action: "put_on_hold",
        actorId: user.id,
        oldValue: { status: consultancy.status },
        newValue: { status: updated.status, reason: created.reason },
      },
      tx
    );

    return { hold: created, consultancy: updated };
  });

  return Response.json({ data: result }, { status: 201 });
}
