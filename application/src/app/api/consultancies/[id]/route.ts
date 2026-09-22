import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { consultancies, clients, agreements } from "@/db/schema";
import { getConsultancyById, getClientByConsultancyId, getAgreementByConsultancyId } from "@/db/queries/consultancies";

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

  const [client, agreement] = await Promise.all([
    getClientByConsultancyId(id),
    getAgreementByConsultancyId(id),
  ]);

  return Response.json({ data: { consultancy, client, agreement } });
}

/**
 * Patches a consultancy. Two distinct editable windows:
 *  - `draft`: full edit (consultancy/client/agreement) by the creator or an
 *    elevated role — pre-submission, nothing is locked yet.
 *  - `clarification_required` (Phase 6): only the originating faculty/creator
 *    may edit, and only the top-level consultancy columns named in
 *    `flaggedFields` (set by `verifyStage`'s "return" decision) — no
 *    client/agreement edits here, and any other field name is rejected.
 * Every other status is locked from ordinary edits.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const existing = await getConsultancyById(id);
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.status === "clarification_required") {
    if (existing.createdBy !== user.id && existing.facultyInChargeId !== user.id && !user.roles.includes("system_admin")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) ?? {};
    const allowed = new Set(existing.flaggedFields ?? []);
    const disallowed = Object.keys(body).filter((key) => !allowed.has(key));
    if (disallowed.length > 0) {
      return Response.json(
        { error: `These fields are not flagged for clarification and cannot be edited: ${disallowed.join(", ")}` },
        { status: 400 }
      );
    }

    if (Object.keys(body).length > 0) {
      await db
        .update(consultancies)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(consultancies.id, id));
    }

    const updated = await getConsultancyById(id);
    return Response.json({ data: updated });
  }

  if (existing.isLocked || existing.status !== "draft") {
    return Response.json(
      { error: "This record is locked and can only be edited via the clarification workflow" },
      { status: 409 }
    );
  }

  if (existing.createdBy !== user.id && !user.roles.some((r) => ["hod", "iiic_admin", "system_admin"].includes(r))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { client, agreement, ...consultancyFields } = body ?? {};

  if (Object.keys(consultancyFields).length > 0) {
    await db
      .update(consultancies)
      .set({ ...consultancyFields, updatedAt: new Date() })
      .where(eq(consultancies.id, id));
  }

  if (client) {
    const existingClient = await getClientByConsultancyId(id);
    if (existingClient) {
      await db.update(clients).set(client).where(eq(clients.id, existingClient.id));
    } else {
      await db.insert(clients).values({ ...client, consultancyId: id });
    }
  }

  if (agreement) {
    const existingAgreement = await getAgreementByConsultancyId(id);
    if (existingAgreement) {
      await db.update(agreements).set(agreement).where(eq(agreements.id, existingAgreement.id));
    } else {
      await db.insert(agreements).values({ ...agreement, consultancyId: id });
    }
  }

  const updated = await getConsultancyById(id);
  return Response.json({ data: updated });
}
