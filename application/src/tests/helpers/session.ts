import "dotenv/config";
import { encode } from "next-auth/jwt";
import { env } from "@/lib/env";
import type { Role } from "@/db/schema/enums";

const SESSION_COOKIE_NAME = "authjs.session-token";

/**
 * Crafts a valid Auth.js session cookie for integration tests, bypassing the
 * real Keycloak OAuth handshake (covered separately, manually, against a
 * live Keycloak realm — see keycloak/realm-export.json).
 */
export async function createTestSessionCookie(user: {
  userId: string;
  roles: Role[];
  departmentId?: string | null;
  name?: string;
  email?: string;
}) {
  const jwt = await encode({
    secret: env.NEXTAUTH_SECRET,
    salt: SESSION_COOKIE_NAME,
    token: {
      userId: user.userId,
      roles: user.roles,
      departmentId: user.departmentId ?? null,
      name: user.name ?? "Test User",
      email: user.email ?? "test.user@caias.in",
      sub: user.userId,
    },
  });

  return `${SESSION_COOKIE_NAME}=${jwt}`;
}
