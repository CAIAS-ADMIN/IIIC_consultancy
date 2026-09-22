import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { env } from "@/lib/env";
import { syncUserFromClaims } from "@/db/queries/users";
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
        });

        token.userId = localUser.id;
        token.roles = localUser.roles;
        token.departmentId = localUser.departmentId;
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
