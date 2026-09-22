import { db } from "@/db";
import type { AuthedUser } from "@/lib/auth/requireRole";
import type { Role, ConfidentialityLevel } from "@/db/schema/enums";
import type { getConsultancyById } from "@/db/queries/consultancies";

type ConsultancyRow = NonNullable<Awaited<ReturnType<typeof getConsultancyById>>>;

const ELEVATED_ROLES: Role[] = ["hod", "iiic_admin", "finance", "competent_authority", "system_admin", "audit_readonly"];
const RESTRICTED_ROLES: Role[] = ["iiic_admin", "system_admin", "competent_authority", "audit_readonly"];

/**
 * There's no explicit visibility matrix in the spec for `confidentiality_level`
 * (every system role is internal staff — there's no external/client login),
 * so this is a deliberate, conservative default pending real requirements:
 *  - public / internal: any authenticated user.
 *  - confidential: the record's owner/faculty-in-charge/coordinator/HOD, an
 *    assigned team member, or an elevated role (verification/approval/audit chain).
 *  - restricted: only the record's owner/faculty-in-charge, or the small set
 *    of roles that sit above the whole workflow (admin, competent authority, audit).
 */
export async function canViewDocument(
  user: AuthedUser,
  consultancy: ConsultancyRow,
  confidentialityLevel: ConfidentialityLevel
): Promise<boolean> {
  if (confidentialityLevel === "public" || confidentialityLevel === "internal") {
    return true;
  }

  const isOwner =
    consultancy.createdBy === user.id ||
    consultancy.facultyInChargeId === user.id ||
    consultancy.departmentCoordinatorId === user.id ||
    consultancy.hodApproverId === user.id;

  if (confidentialityLevel === "restricted") {
    return isOwner || user.roles.some((role) => RESTRICTED_ROLES.includes(role));
  }

  // confidential
  if (isOwner || user.roles.some((role) => ELEVATED_ROLES.includes(role))) {
    return true;
  }

  const membership = await db.query.consultancyTeamMembers.findFirst({
    where: (member, { and, eq: eqOp }) =>
      and(eqOp(member.consultancyId, consultancy.id), eqOp(member.userId, user.id)),
  });
  return Boolean(membership);
}
