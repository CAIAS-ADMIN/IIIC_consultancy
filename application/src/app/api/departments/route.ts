import type { NextRequest } from "next/server";
import { requireRole, requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { recordAuditEvent } from "@/lib/audit";
import { departmentInputSchema } from "@/lib/validation/departments";

/**
 * Active departments only — this feeds the shell's department switcher and
 * other pickers, where a deactivated department must not be selectable. Any
 * authenticated role may read it. The admin Departments screen reads the
 * full list (incl. inactive) server-side, not through this route.
 */
export async function GET() {
  try {
    await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const rows = await db.query.departments.findMany({
    where: eq(departments.isActive, true),
    orderBy: [asc(departments.name)],
    columns: { id: true, name: true, code: true },
  });

  return Response.json({ data: rows });
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireRole("system_admin", "iiic_admin");
  } catch (error) {
    return authErrorResponse(error);
  }

  const parsed = departmentInputSchema.pick({ name: true, code: true }).required().safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const { name, code } = parsed.data;

  const existingCode = await db.query.departments.findFirst({ where: eq(departments.code, code) });
  if (existingCode) {
    return Response.json({ error: `Department code "${code}" already exists.` }, { status: 409 });
  }

  const [created] = await db.insert(departments).values({ name, code, isActive: true }).returning();

  await recordAuditEvent({
    entityType: "department",
    entityId: created.id,
    action: "created",
    actorId: user.id,
    oldValue: null,
    newValue: created,
  });

  return Response.json({ data: created }, { status: 201 });
}
