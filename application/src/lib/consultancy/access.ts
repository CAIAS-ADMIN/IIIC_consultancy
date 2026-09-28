import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { consultancyTeamMembers } from "@/db/schema";
import type { AuthedUser } from "@/lib/auth/requireRole";
import type { getConsultancyById } from "@/db/queries/consultancies";
import { canViewAllDepartments } from "./scope";

type ConsultancyRow = NonNullable<Awaited<ReturnType<typeof getConsultancyById>>>;

const OVERSIGHT_ROLES = ["iiic_admin", "system_admin"] as const;

/**
 * Creator, faculty-in-charge, an assigned team member, an institution-wide
 * admin, or the HOD of the owning department — used to gate
 * progress/milestone writes on an active consultancy.
 */
export async function isConsultancyMember(user: AuthedUser, consultancy: ConsultancyRow): Promise<boolean> {
  if (consultancy.createdBy === user.id || consultancy.facultyInChargeId === user.id) {
    return true;
  }
  if (user.roles.some((role) => OVERSIGHT_ROLES.includes(role as (typeof OVERSIGHT_ROLES)[number]))) {
    return true;
  }
  if (user.roles.includes("hod") && user.departmentId && user.departmentId === consultancy.departmentId) {
    return true;
  }
  const membership = await db.query.consultancyTeamMembers.findFirst({
    where: and(eq(consultancyTeamMembers.consultancyId, consultancy.id), eq(consultancyTeamMembers.userId, user.id)),
  });
  return Boolean(membership);
}

/**
 * Who may open a consultancy record (detail page, printable records, audit
 * trail): any view-all role (IIIC admin, finance, …), the record's own
 * people, or a faculty member / HOD of the owning department — the same
 * department scoping search, reports and export apply (see
 * `resolveDepartmentScope`). An HOD never sees another department's records.
 */
export async function canViewConsultancy(user: AuthedUser, consultancy: ConsultancyRow): Promise<boolean> {
  if (canViewAllDepartments(user)) {
    return true;
  }
  if (user.departmentId && user.departmentId === consultancy.departmentId) {
    return true;
  }
  if (consultancy.departmentCoordinatorId === user.id || consultancy.hodApproverId === user.id) {
    return true;
  }
  return isConsultancyMember(user, consultancy);
}

/**
 * True when the caller's only authority over this record is an HOD role for
 * a different department — such a caller must not act on it (hold, cancel,
 * edit, decide…) even though `requireRole("hod", …)` let them through.
 */
export function isOutOfDepartmentHod(user: AuthedUser, consultancy: Pick<ConsultancyRow, "departmentId">): boolean {
  if (canViewAllDepartments(user) || !user.roles.includes("hod")) return false;
  return !user.departmentId || user.departmentId !== consultancy.departmentId;
}

/**
 * Who may edit or submit a draft: its creator, its faculty-in-charge (an
 * admin may have started it on their behalf), a CAIAS admin, or the HOD of
 * the owning department.
 */
export function canEditDraft(user: AuthedUser, consultancy: Pick<ConsultancyRow, "createdBy" | "facultyInChargeId" | "departmentId">): boolean {
  if (consultancy.createdBy === user.id || consultancy.facultyInChargeId === user.id) return true;
  if (user.roles.some((role) => OVERSIGHT_ROLES.includes(role as (typeof OVERSIGHT_ROLES)[number]))) return true;
  return user.roles.includes("hod") && Boolean(user.departmentId) && user.departmentId === consultancy.departmentId;
}

/**
 * Who may upload (and, while still a draft, remove) a consultancy's
 * documents: the same people who may edit its draft — creator,
 * faculty-in-charge, a CAIAS admin, or the owning department's HOD.
 */
export function canManageDocuments(user: AuthedUser, consultancy: Pick<ConsultancyRow, "createdBy" | "facultyInChargeId" | "departmentId">): boolean {
  return canEditDraft(user, consultancy);
}
