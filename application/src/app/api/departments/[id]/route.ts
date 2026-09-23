import type { NextRequest } from "next/server";
import { and, count, eq, ne } from "drizzle-orm";
import { requireRole } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { approvalStageConfigs, consultancies, consultancyDepartments, departments, users } from "@/db/schema";
import { recordAuditEvent } from "@/lib/audit";
import { departmentInputSchema } from "@/lib/validation/departments";

/** Update department name, code, or active status (system_admin or iiic_admin). Deactivation is the normal way to retire a department. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireRole("system_admin", "iiic_admin");
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const existing = await db.query.departments.findFirst({ where: eq(departments.id, id) });
  if (!existing) {
    return Response.json({ error: "Department not found" }, { status: 404 });
  }

  const parsed = departmentInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const changes = parsed.data;
  if (Object.keys(changes).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  if (changes.code && changes.code !== existing.code) {
    const clash = await db.query.departments.findFirst({
      where: and(eq(departments.code, changes.code), ne(departments.id, id)),
    });
    if (clash) {
      return Response.json({ error: `Department code "${changes.code}" already exists.` }, { status: 409 });
    }
  }

  const [updated] = await db
    .update(departments)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(departments.id, id))
    .returning();

  await recordAuditEvent({
    entityType: "department",
    entityId: id,
    action: "updated",
    actorId: user.id,
    oldValue: existing,
    newValue: updated,
  });

  return Response.json({ data: updated });
}

/**
 * Hard-delete — only for a department nothing refers to (e.g. one created by
 * mistake). Every table pointing at `departments` is checked first: the
 * FKs are a mix of `restrict` (would 500), `set null` (would silently strip
 * users of their department scope) and `cascade` (would silently delete
 * approval-chain config), none of which is acceptable as a side effect.
 * Anything in use must be deactivated via PATCH instead.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireRole("system_admin", "iiic_admin");
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const existing = await db.query.departments.findFirst({ where: eq(departments.id, id) });
  if (!existing) {
    return Response.json({ error: "Department not found" }, { status: 404 });
  }

  const [[primary], [secondary], [members], [stageConfigs]] = await Promise.all([
    db.select({ n: count() }).from(consultancies).where(eq(consultancies.departmentId, id)),
    db.select({ n: count() }).from(consultancyDepartments).where(eq(consultancyDepartments.departmentId, id)),
    db.select({ n: count() }).from(users).where(eq(users.departmentId, id)),
    db.select({ n: count() }).from(approvalStageConfigs).where(eq(approvalStageConfigs.departmentId, id)),
  ]);

  const references = [
    primary.n > 0 && `${primary.n} consultanc${primary.n === 1 ? "y" : "ies"}`,
    secondary.n > 0 && `${secondary.n} collaborating consultanc${secondary.n === 1 ? "y" : "ies"}`,
    members.n > 0 && `${members.n} user${members.n === 1 ? "" : "s"}`,
    stageConfigs.n > 0 && `${stageConfigs.n} approval-chain rule${stageConfigs.n === 1 ? "" : "s"}`,
  ].filter(Boolean);

  if (references.length > 0) {
    return Response.json(
      {
        error: `"${existing.name}" is still referenced by ${references.join(", ")}, so it can't be deleted. Deactivate it instead.`,
        canDeactivate: true,
      },
      { status: 409 }
    );
  }

  await db.delete(departments).where(eq(departments.id, id));

  await recordAuditEvent({
    entityType: "department",
    entityId: id,
    action: "deleted",
    actorId: user.id,
    oldValue: existing,
    newValue: null,
  });

  return Response.json({ data: { id } });
}
