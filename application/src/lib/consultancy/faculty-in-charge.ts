import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { Role } from "@/db/schema/enums";
import type { AuthedUser } from "@/lib/auth/requireRole";

/** Roles that may register a consultancy on a faculty member's behalf (choose its faculty-in-charge). */
export const ON_BEHALF_ROLES: Role[] = ["iiic_admin", "system_admin"];

export function canChooseFacultyInCharge(roles: readonly Role[]): boolean {
  return roles.some((role) => ON_BEHALF_ROLES.includes(role));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reads a requested `facultyInChargeId` from a wizard request body. Only an
 * on-behalf role may set it — anyone else's value is ignored (the record
 * stays theirs). Returns the user id to store, `undefined` for "no change",
 * or an error message for an unknown user.
 */
export async function resolveRequestedFacultyInCharge(
  user: AuthedUser,
  requested: unknown
): Promise<{ userId?: string; error?: string }> {
  if (!canChooseFacultyInCharge(user.roles) || typeof requested !== "string" || requested === "") {
    return {};
  }
  if (!UUID_RE.test(requested)) {
    return { error: "Select a valid faculty consultant" };
  }
  const row = await db.query.users.findFirst({ where: eq(users.id, requested), columns: { id: true } });
  return row ? { userId: row.id } : { error: "The selected faculty consultant does not exist" };
}
