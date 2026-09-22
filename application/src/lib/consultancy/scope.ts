import type { AuthedUser } from "@/lib/auth/requireRole";

const OVERSIGHT_ROLES = ["hod", "iiic_admin", "finance", "competent_authority", "system_admin", "audit_readonly"] as const;

/**
 * Search/report/export scoping (Phase 12): a user holding only `faculty`
 * (no oversight role) is restricted to their own department — never blocked
 * outright, just narrowed. Any oversight role sees everything.
 *
 * Returns `undefined` for "no restriction", `null` for "restricted, but the
 * user has no department on record so nothing can match" (empty result,
 * not an error), or a department id to filter by.
 */
export function resolveDepartmentScope(user: AuthedUser): string | null | undefined {
  const hasOversightRole = user.roles.some((role) => OVERSIGHT_ROLES.includes(role as (typeof OVERSIGHT_ROLES)[number]));
  if (hasOversightRole) {
    return undefined;
  }
  return user.departmentId ?? null;
}
