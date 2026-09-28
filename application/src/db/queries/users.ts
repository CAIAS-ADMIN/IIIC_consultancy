import { and, eq, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { departments, users } from "@/db/schema";
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
  department?: string | null;
}) {
  // Keycloak's `department` attribute holds a department name or code. It only
  // overrides the stored department when it names a real one — an absent or
  // unrecognised value leaves the existing (e.g. pre-imported) department alone.
  const departmentId = input.department ? await resolveDepartmentId(input.department) : null;

  // A re-imported Keycloak realm gives existing people a new `sub`. Re-link their
  // existing row (matched on the realm's email) instead of failing on the unique
  // email — that keeps every consultancy, approval and audit entry attached to them.
  const alreadyLinked = await db.query.users.findFirst({ where: eq(users.keycloakSub, input.keycloakSub), columns: { id: true } });
  if (!alreadyLinked) {
    await db
      .update(users)
      .set({ keycloakSub: input.keycloakSub, updatedAt: sql`now()` })
      .where(and(eq(users.email, input.email), ne(users.keycloakSub, input.keycloakSub)));
  }

  const [user] = await db
    .insert(users)
    .values({
      keycloakSub: input.keycloakSub,
      name: input.name,
      email: input.email,
      roles: input.roles,
      employeeId: input.employeeId ?? null,
      phone: input.phone ?? null,
      departmentId,
    })
    .onConflictDoUpdate({
      target: users.keycloakSub,
      set: {
        name: input.name,
        email: input.email,
        roles: input.roles,
        employeeId: input.employeeId ?? null,
        phone: input.phone ?? null,
        ...(departmentId ? { departmentId } : {}),
        updatedAt: sql`now()`,
      },
    })
    .returning();

  return user;
}

async function resolveDepartmentId(value: string): Promise<string | null> {
  const needle = value.trim().toLowerCase();
  if (!needle) return null;
  const [row] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(or(sql`lower(${departments.name}) = ${needle}`, sql`lower(${departments.code}) = ${needle}`))
    .limit(1);
  if (!row) console.warn("[auth] Keycloak department not found in departments table", { department: value });
  return row?.id ?? null;
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

/** Cheap primary-key check used on every session read (see the `jwt` callback in auth.ts). */
export async function userExists(id: string): Promise<boolean> {
  const row = await db.query.users.findFirst({ where: eq(users.id, id), columns: { id: true } });
  return Boolean(row);
}
