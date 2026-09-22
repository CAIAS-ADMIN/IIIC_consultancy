import type { NextRequest } from "next/server";
import { eq, desc } from "drizzle-orm";
import { requireRole, requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { consultancies } from "@/db/schema";
import { consultancyStatusEnum, type ConsultancyStatus } from "@/db/schema/enums";
import { draftConsultancySchema } from "@/lib/validation/consultancy";
import { recordAuditEvent } from "@/lib/audit";

/**
 * Lists consultancies, optionally filtered by `status` — e.g.
 * `?status=active` for an "active" count/roster that correctly excludes
 * `cancelled`/`terminated`/`completed_closed` records (Phase 8) without
 * deleting them; they stay reachable individually via `GET /:id`.
 */
export async function GET(request: NextRequest) {
  try {
    await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const statusParam = request.nextUrl.searchParams.get("status");
  if (statusParam && !(consultancyStatusEnum.enumValues as readonly string[]).includes(statusParam)) {
    return Response.json({ error: `Invalid status '${statusParam}'` }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(consultancies)
    .where(statusParam ? eq(consultancies.status, statusParam as ConsultancyStatus) : undefined)
    .orderBy(desc(consultancies.createdAt));

  return Response.json({ data: rows, count: rows.length });
}

/** createDraftConsultancy — status stays `draft`, no Consultancy ID consumed yet. */
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireRole("faculty", "hod", "iiic_admin", "system_admin");
  } catch (error) {
    return authErrorResponse(error);
  }

  const body = await request.json();
  const parsed = draftConsultancySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [draft] = await db
    .insert(consultancies)
    .values({
      ...parsed.data,
      facultyInChargeId: user.id,
      createdBy: user.id,
    })
    .returning();

  await recordAuditEvent({
    consultancyId: draft.id,
    entityType: "consultancy",
    entityId: draft.id,
    action: "draft_created",
    actorId: user.id,
    newValue: draft,
  });

  return Response.json({ data: draft }, { status: 201 });
}
