import type { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { clientAcceptances, documents } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { isConsultancyMember } from "@/lib/consultancy/access";
import { recordClientAcceptanceSchema } from "@/lib/validation/closure";
import { recordAuditEvent } from "@/lib/audit";

const RECORDABLE_STATUSES = ["active", "closure_requested"] as const;

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

  const rows = await db.select().from(clientAcceptances).where(eq(clientAcceptances.consultancyId, id)).orderBy(desc(clientAcceptances.createdAt));
  return Response.json({ data: rows });
}

/** Records that the client formally accepted deliverables — one of the closure gate checklist items when `clientAcceptanceRequired`. */
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
  if (!RECORDABLE_STATUSES.includes(consultancy.status as (typeof RECORDABLE_STATUSES)[number])) {
    return Response.json({ error: `Cannot record client acceptance for a consultancy in status '${consultancy.status}'` }, { status: 409 });
  }
  if (!(await isConsultancyMember(user, consultancy))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = recordClientAcceptanceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (input.documentId) {
    const doc = await db.query.documents.findFirst({ where: eq(documents.id, input.documentId) });
    if (!doc || doc.consultancyId !== id) {
      return Response.json({ error: "documentId does not belong to this consultancy" }, { status: 400 });
    }
  }

  const [created] = await db
    .insert(clientAcceptances)
    .values({ ...input, consultancyId: id })
    .returning();

  await recordAuditEvent({
    consultancyId: id,
    entityType: "client_acceptance",
    entityId: created.id,
    action: "client_acceptance_recorded",
    actorId: user.id,
    newValue: { acceptedByName: created.acceptedByName, acceptanceDate: created.acceptanceDate },
  });

  return Response.json({ data: created }, { status: 201 });
}
