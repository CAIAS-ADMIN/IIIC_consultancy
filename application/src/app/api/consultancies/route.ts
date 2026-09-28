import type { NextRequest } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { requireRole, requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { consultancies } from "@/db/schema";
import { consultancyStatusEnum, type ConsultancyStatus } from "@/db/schema/enums";
import { createDraftConsultancySchema } from "@/lib/validation/consultancy";
import { recordAuditEvent } from "@/lib/audit";
import { resolveDepartmentScope } from "@/lib/consultancy/scope";
import { resolveRequestedFacultyInCharge } from "@/lib/consultancy/faculty-in-charge";

/**
 * Lists consultancies, optionally filtered by `status` — e.g.
 * `?status=active` for an "active" count/roster that correctly excludes
 * `cancelled`/`terminated`/`completed_closed` records (Phase 8) without
 * deleting them; they stay reachable individually via `GET /:id`.
 *
 * Department-scoped the same way `search`/`reports`/`export` (Phase 12) are —
 * a `faculty`-only caller is narrowed to their own department rather than
 * seeing every consultancy in the institution; any oversight role is
 * unrestricted. This route predates Phase 12 and had been left unscoped.
 */
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const statusParam = request.nextUrl.searchParams.get("status");
  if (statusParam && !(consultancyStatusEnum.enumValues as readonly string[]).includes(statusParam)) {
    return Response.json({ error: `Invalid status '${statusParam}'` }, { status: 400 });
  }

  const scope = resolveDepartmentScope(user);
  if (scope === null) {
    return Response.json({ data: [], count: 0 });
  }

  const conditions = [
    statusParam ? eq(consultancies.status, statusParam as ConsultancyStatus) : undefined,
    scope ? eq(consultancies.departmentId, scope) : undefined,
  ].filter((c) => c !== undefined);

  const rows = await db
    .select()
    .from(consultancies)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
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
  // Blank wizard fields arrive as "" — treat them as "not filled in yet".
  const filled = Object.fromEntries(Object.entries(body ?? {}).filter(([, value]) => value !== ""));
  const parsed = createDraftConsultancySchema.safeParse(filled);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  // An admin registering on a faculty member's behalf makes that faculty member the one in charge.
  const facultyInCharge = await resolveRequestedFacultyInCharge(user, body?.facultyInChargeId);
  if (facultyInCharge.error) {
    return Response.json({ error: facultyInCharge.error }, { status: 400 });
  }

  const [draft] = await db
    .insert(consultancies)
    .values({
      ...parsed.data,
      // NOT NULL columns a brand-new draft may not have yet; later draft saves fill them in.
      title: parsed.data.title ?? "Untitled draft",
      consultancyTypeCode: parsed.data.consultancyTypeCode ?? "",
      teamTypeCode: parsed.data.teamTypeCode ?? "",
      consultancyAreaCode: parsed.data.consultancyAreaCode ?? "",
      facultyInChargeId: facultyInCharge.userId ?? user.id,
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
