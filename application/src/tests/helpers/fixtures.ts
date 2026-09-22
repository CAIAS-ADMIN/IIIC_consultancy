import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users, departments, approvalStageConfigs } from "@/db/schema";
import type { Role } from "@/db/schema/enums";

export async function upsertTestUser(input: {
  keycloakSub: string;
  name: string;
  email: string;
  roles: Role[];
  departmentId?: string | null;
}) {
  const [user] = await db
    .insert(users)
    .values(input)
    .onConflictDoUpdate({
      target: users.keycloakSub,
      set: {
        name: input.name,
        email: input.email,
        roles: input.roles,
        departmentId: input.departmentId ?? null,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return user;
}

export async function upsertTestDepartment(input: { code: string; name: string }) {
  const [department] = await db
    .insert(departments)
    .values(input)
    .onConflictDoUpdate({ target: departments.code, set: { name: input.name } })
    .returning();
  return department;
}

export async function upsertTestApprovalStageConfig(input: {
  id: string;
  departmentId?: string | null;
  consultancyAreaCode?: string | null;
  minValue?: string | null;
  maxValue?: string | null;
  stage: string;
  sequence: number;
  approverRole: Role;
  isRequired?: boolean;
}) {
  const values = {
    departmentId: input.departmentId ?? null,
    consultancyAreaCode: input.consultancyAreaCode ?? null,
    minValue: input.minValue ?? null,
    maxValue: input.maxValue ?? null,
    stage: input.stage,
    sequence: input.sequence,
    approverRole: input.approverRole,
    isRequired: input.isRequired ?? true,
  };
  const [config] = await db
    .insert(approvalStageConfigs)
    .values({ id: input.id, ...values })
    .onConflictDoUpdate({ target: approvalStageConfigs.id, set: values })
    .returning();
  return config;
}

export const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
