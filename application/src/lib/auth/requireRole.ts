import { auth } from "@/auth";
import type { Role } from "@/db/schema/enums";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized: no active session");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(required: Role[]) {
    super(`Forbidden: requires one of [${required.join(", ")}]`);
    this.name = "ForbiddenError";
  }
}

export type AuthedUser = {
  id: string;
  name: string | null;
  email: string | null;
  roles: Role[];
  departmentId: string | null;
};

/**
 * Asserts the current session has at least one of `roles`. Use inside every
 * Server Action / Route Handler that mutates data — Proxy-level route
 * protection is a convenience, not a security boundary (Server Functions
 * bypass proxy matchers), so this must be the real gate.
 */
export async function requireRole(...roles: Role[]): Promise<AuthedUser> {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError();
  }

  if (roles.length > 0 && !session.user.roles.some((role) => roles.includes(role))) {
    throw new ForbiddenError(roles);
  }

  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    roles: session.user.roles,
    departmentId: session.user.departmentId,
  };
}

/** Asserts a valid session exists, without any role constraint. */
export async function requireSession(): Promise<AuthedUser> {
  return requireRole();
}
