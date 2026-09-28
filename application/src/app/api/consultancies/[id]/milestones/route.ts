import type { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { milestones } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { isConsultancyMember, canViewConsultancy } from "@/lib/consultancy/access";
import { createMilestoneSchema } from "@/lib/validation/milestones";
import { recordAuditEvent } from "@/lib/audit";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let viewer;
  try {
    viewer = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const consultancy = await getConsultancyById(id);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await canViewConsultancy(viewer, consultancy))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db.select().from(milestones).where(eq(milestones.consultancyId, id)).orderBy(asc(milestones.plannedDate));
  return Response.json({ data: rows });
}

/** Creates a milestone to be tracked against — only on an `active` consultancy. */
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
    return Response.json({ error: `Cannot add a milestone to a consultancy in status '${consultancy.status}'` }, { status: 409 });
  }
  if (!(await isConsultancyMember(user, consultancy))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createMilestoneSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [created] = await db
    .insert(milestones)
    .values({ ...parsed.data, consultancyId: id })
    .returning();

  await recordAuditEvent({
    consultancyId: id,
    entityType: "milestone",
    entityId: created.id,
    action: "milestone_created",
    actorId: user.id,
    newValue: created,
  });

  return Response.json({ data: created }, { status: 201 });
}
