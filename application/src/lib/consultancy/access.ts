import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { consultancyTeamMembers } from "@/db/schema";
import type { AuthedUser } from "@/lib/auth/requireRole";
import type { getConsultancyById } from "@/db/queries/consultancies";

type ConsultancyRow = NonNullable<Awaited<ReturnType<typeof getConsultancyById>>>;

const OVERSIGHT_ROLES = ["hod", "iiic_admin", "system_admin"] as const;

/** Creator, faculty-in-charge, an assigned team member, or an oversight role — used to gate progress/milestone writes on an active consultancy. */
export async function isConsultancyMember(user: AuthedUser, consultancy: ConsultancyRow): Promise<boolean> {
  if (consultancy.createdBy === user.id || consultancy.facultyInChargeId === user.id) {
    return true;
  }
  if (user.roles.some((role) => OVERSIGHT_ROLES.includes(role as (typeof OVERSIGHT_ROLES)[number]))) {
    return true;
  }
  const membership = await db.query.consultancyTeamMembers.findFirst({
    where: and(eq(consultancyTeamMembers.consultancyId, consultancy.id), eq(consultancyTeamMembers.userId, user.id)),
  });
  return Boolean(membership);
}
