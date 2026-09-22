import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { Role } from "@/db/schema/enums";

/**
 * Upserts the local `users` row from Keycloak claims on every sign-in, so FK
 * references (created_by, verified_by, ...) point at a stable local id
 * instead of raw Keycloak subs scattered across the schema.
 */
export async function syncUserFromClaims(input: {
  keycloakSub: string;
  name: string;
  email: string;
  roles: Role[];
  employeeId?: string | null;
  phone?: string | null;
}) {
  const [user] = await db
    .insert(users)
    .values({
      keycloakSub: input.keycloakSub,
      name: input.name,
      email: input.email,
      roles: input.roles,
      employeeId: input.employeeId ?? null,
      phone: input.phone ?? null,
    })
    .onConflictDoUpdate({
      target: users.keycloakSub,
      set: {
        name: input.name,
        email: input.email,
        roles: input.roles,
        employeeId: input.employeeId ?? null,
        phone: input.phone ?? null,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  return user;
}

export async function getUserByKeycloakSub(keycloakSub: string) {
  return db.query.users.findFirst({
    where: eq(users.keycloakSub, keycloakSub),
  });
}

export async function getUserById(id: string) {
  return db.query.users.findFirst({
    where: eq(users.id, id),
  });
}
