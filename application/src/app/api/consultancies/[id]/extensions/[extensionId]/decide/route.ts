import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { extensions, consultancies } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { isOutOfDepartmentHod } from "@/lib/consultancy/access";
import { decideExtensionSchema } from "@/lib/validation/lifecycle";
import { recordAuditEvent } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";

/**
 * decideExtension — on approve, `currentCompletionDate` moves to the revised
 * date while `originalCompletionDate` (on both the consultancy and this
 * extension row) stays untouched, so both remain independently visible. On
 * reject, no date changes; the consultancy just returns to `active`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; extensionId: string }> }
) {
  let user;
  try {
    user = await requireRole("hod", "iiic_admin", "competent_authority", "system_admin");
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id, extensionId } = await params;
  const consultancy = await getConsultancyById(id);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (isOutOfDepartmentHod(user, consultancy)) {
    return Response.json({ error: "Forbidden: HOD can only act on consultancies of their own department" }, { status: 403 });
  }

  const extension = await db.query.extensions.findFirst({ where: eq(extensions.id, extensionId) });
  if (!extension || extension.consultancyId !== id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (extension.status !== "requested") {
    return Response.json({ error: `This extension has already been decided ('${extension.status}')` }, { status: 409 });
  }

  const body = await request.json();
  const parsed = decideExtensionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const approved = input.decision === "approve";

  const result = await db.transaction(async (tx) => {
    const [updatedExtension] = await tx
      .update(extensions)
      .set({ status: approved ? "approved" : "rejected", decidedBy: user.id, decidedAt: new Date() })
      .where(eq(extensions.id, extensionId))
      .returning();

    const [updatedConsultancy] = await tx
      .update(consultancies)
      .set({
        status: "active",
        currentCompletionDate: approved ? extension.proposedCompletionDate : consultancy.currentCompletionDate,
        updatedAt: new Date(),
      })
      .where(eq(consultancies.id, id))
      .returning();

    await recordAuditEvent(
      {
        consultancyId: id,
        entityType: "extension",
        entityId: extensionId,
        action: approved ? "extension_approved" : "extension_rejected",
        actorId: user.id,
        oldValue: { currentCompletionDate: consultancy.currentCompletionDate },
        newValue: { currentCompletionDate: updatedConsultancy.currentCompletionDate },
        comments: input.comments,
      },
      tx
    );

    await notifyUser(
      {
        userId: consultancy.facultyInChargeId,
        consultancyId: id,
        type: "extension_decided",
        message: approved
          ? `Extension approved for ${consultancy.consultancyCode}: new completion date ${extension.proposedCompletionDate}.`
          : `Extension request for ${consultancy.consultancyCode} was not approved.${input.comments ? ` ${input.comments}` : ""}`,
      },
      tx
    );

    return { extension: updatedExtension, consultancy: updatedConsultancy };
  });

  return Response.json({ data: result });
}
