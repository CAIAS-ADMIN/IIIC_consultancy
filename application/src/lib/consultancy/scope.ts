import type { AuthedUser } from "@/lib/auth/requireRole";

/** Only the fields scoping reads — any fuller user object (session user, AuthedUser) fits. */
type ScopedUser = Pick<AuthedUser, "roles" | "departmentId"> & Partial<AuthedUser>;

/**
 * Roles that see every department's consultancies. `hod` is deliberately
 * absent — an HOD sees only their own department's records and queue.
 */
export const VIEW_ALL_ROLES = ["iiic_admin", "finance", "competent_authority", "system_admin", "audit_readonly"] as const;

export function canViewAllDepartments(user: ScopedUser): boolean {
  return user.roles.some((role) => VIEW_ALL_ROLES.includes(role as (typeof VIEW_ALL_ROLES)[number]));
}

/**
 * Search/report/export scoping: a user without a view-all role (a faculty
 * member or an HOD) is restricted to their own department — never blocked
 * outright, just narrowed. Any view-all role sees everything.
 *
 * Returns `undefined` for "no restriction", `null` for "restricted, but the
 * user has no department on record so nothing can match" (empty result,
 * not an error), or a department id to filter by.
 */
export function resolveDepartmentScope(user: ScopedUser): string | null | undefined {
  if (canViewAllDepartments(user)) {
    return undefined;
  }
  return user.departmentId ?? null;
}

/** A department id that can never match — used when a scoped user has no department on record. */
export const NO_DEPARTMENT = "00000000-0000-0000-0000-000000000000";

/**
 * The department filter a page should actually apply: a view-all user gets
 * whatever they picked in the `?department=` switcher; a scoped user is
 * pinned to their own department whatever the URL says.
 */
export function effectiveDepartmentFilter(
  user: ScopedUser,
  requested: string | undefined
): string | undefined {
  const scope = resolveDepartmentScope(user);
  if (scope === undefined) return requested;
  return scope ?? NO_DEPARTMENT;
}
