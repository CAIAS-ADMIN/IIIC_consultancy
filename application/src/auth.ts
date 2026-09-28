import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { env } from "@/lib/env";
import { syncUserFromClaims, userExists } from "@/db/queries/users";
import type { Role } from "@/db/schema/enums";

const VALID_ROLES: readonly Role[] = [
  "faculty",
  "hod",
  "iiic_admin",
  "finance",
  "competent_authority",
  "system_admin",
  "audit_readonly",
];

function extractRoles(profile: Record<string, unknown> | undefined): Role[] {
  const realmAccess = profile?.realm_access as { roles?: string[] } | undefined;
  const rawRoles = realmAccess?.roles ?? [];
  return rawRoles.filter((role): role is Role => (VALID_ROLES as string[]).includes(role));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Keycloak({
      clientId: env.KEYCLOAK_CLIENT_ID,
      clientSecret: env.KEYCLOAK_CLIENT_SECRET,
      issuer: env.KEYCLOAK_ISSUER,
    }),
  ],
  // 8-hour session lifetime (re-authentication required after, matching a
  // single working day) — re-issued on activity via the default `updateAge`.
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  jwt: { maxAge: 8 * 60 * 60 },
  // proxy.ts sends signed-out/expired navigation to /api/auth/signin; this
  // makes Auth.js forward that on to the branded landing page (with the
  // original callbackUrl) instead of rendering its own unstyled page.
  pages: { signIn: "/" },
  secret: env.NEXTAUTH_SECRET,
  trustHost: true,
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        const roles = extractRoles(profile);
        const keycloakSub = String(profile.sub);
        const localUser = await syncUserFromClaims({
          keycloakSub,
          name: (profile.name as string) ?? (profile.preferred_username as string) ?? "",
          email: (profile.email as string) ?? "",
          roles,
          employeeId: (profile.employee_id as string) ?? null,
          phone: (profile.phone as string) ?? null,
          department: (profile.department as string) ?? null,
        });

        token.userId = localUser.id;
        token.roles = localUser.roles;
        token.departmentId = localUser.departmentId;
      } else if (token.userId && !(await userExists(token.userId))) {
        // The account behind this session was removed (e.g. a data cleanup):
        // end the session instead of letting writes fail on a missing user.
        // Signing in again re-creates the account from the Keycloak claims.
        return null;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId ?? "";
      session.user.roles = token.roles ?? [];
      session.user.departmentId = token.departmentId ?? null;
      return session;
    },
  },
});
