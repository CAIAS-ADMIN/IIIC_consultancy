import type { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { extensions, consultancies, documents } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { isConsultancyMember } from "@/lib/consultancy/access";
import { requestExtensionSchema } from "@/lib/validation/lifecycle";
import { recordAuditEvent } from "@/lib/audit";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const consultancy = await getConsultancyById(id);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db.select().from(extensions).where(eq(extensions.consultancyId, id)).orderBy(desc(extensions.createdAt));
  return Response.json({ data: rows });
}

/**
 * requestExtension — the original completion date is copied from the
 * consultancy's own (immutable, set once at submission) `originalCompletionDate`
 * so it stays attached to this specific request's history even if further
 * extensions happen later.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const consultancy = await getConsultancyById(id);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (consultancy.status !== "active") {
    return Response.json({ error: `Cannot request an extension on a consultancy in status '${consultancy.status}'` }, { status: 409 });
  }
  if (!(await isConsultancyMember(user, consultancy))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = requestExtensionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (!consultancy.originalCompletionDate) {
    return Response.json({ error: "Consultancy has no completion date on record" }, { status: 409 });
  }

  const pending = await db.query.extensions.findFirst({
    where: and(eq(extensions.consultancyId, id), eq(extensions.status, "requested")),
  });
  if (pending) {
    return Response.json({ error: "An extension request is already pending for this consultancy" }, { status: 409 });
  }

  if (input.supportingDocumentId) {
    const doc = await db.query.documents.findFirst({ where: eq(documents.id, input.supportingDocumentId) });
    if (!doc || doc.consultancyId !== id) {
      return Response.json({ error: "supportingDocumentId does not belong to this consultancy" }, { status: 400 });
    }
  }

  const result = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(extensions)
      .values({
        consultancyId: id,
        originalCompletionDate: consultancy.originalCompletionDate!,
        proposedCompletionDate: input.proposedCompletionDate,
        reason: input.reason,
        revisedTimeline: input.revisedTimeline,
        clientConsent: input.clientConsent,
        supportingDocumentId: input.supportingDocumentId,
        requestedBy: user.id,
      })
      .returning();

    await tx.update(consultancies).set({ status: "extension_requested", updatedAt: new Date() }).where(eq(consultancies.id, id));

    await recordAuditEvent(
      {
        consultancyId: id,
        entityType: "extension",
        entityId: created.id,
        action: "extension_requested",
        actorId: user.id,
        newValue: { proposedCompletionDate: created.proposedCompletionDate, reason: created.reason },
      },
      tx
    );

    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
