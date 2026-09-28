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

type PayloadSection = Record<string, unknown>;

/**
 * Fills in the portal-spec-v2 mandatory registration fields (client address
 * and contact, agreement dates, nature/domain, IP answer, payment schedule,
 * declaration…) around a test's minimal submit payload, so each test only
 * spells out what it's actually exercising. Anything the test sets wins.
 */
export function withRegistrationDefaults<T extends Record<string, unknown>>(payload: T): T {
  const p = payload as Record<string, PayloadSection | undefined>;
  const consultancy = p.consultancy ?? {};
  const financial = p.financial ?? {};
  const team = p.team ?? {};
  const scope = p.scope ?? {};
  const totalValue = String(financial.totalValue ?? "50000");
  const startDate = String(consultancy.startDate ?? "2026-01-01");

  const members: PayloadSection[] = ((team.members as PayloadSection[] | undefined) ?? [{ name: "Test Faculty" }]).map((m) => ({
    department: m.isExternal ? undefined : "Test Department",
    ...m,
  }));
  if (!members.some((m) => m.role === "principal_consultant")) {
    members[0] = { ...members[0], role: "principal_consultant" };
  }

  return {
    ...payload,
    consultancy: {
      agreementSignedStatus: "consultancy_agreement",
      natureOfConsultancyCode: "technical_consultancy",
      consultancyDomainCodes: ["computer_science_it"],
      clientProblem: "Client needs a tested integration.",
      objective: "Deliver the integration.",
      reportingFrequency: "monthly",
      ...consultancy,
    },
    client: {
      industrySectorCode: "Information Technology",
      contactPersonName: "Client Contact",
      designation: "Manager",
      contactEmail: "client.contact@example.com",
      contactPhone: "9000000000",
      address: "1 Test Road",
      cityCode: "Bengaluru",
      stateCode: "Karnataka",
      countryCode: "India",
      pinCode: "560001",
      ...p.client,
    },
    agreement: {
      agreementNumber: "AGR-TEST-001",
      agreementDate: "2025-12-15",
      agreementStartDate: startDate,
      agreementEndDate: String(consultancy.expectedCompletionDate ?? "2026-12-31"),
      ...p.agreement,
    },
    team: { ...team, members },
    financial: {
      ...financial,
      // Dated far ahead so the default stage never makes a record "overdue".
      paymentSchedule: financial.paymentSchedule ?? [{ stageLabel: "Final", plannedAmount: totalValue, plannedDate: "2099-12-31" }],
    },
    scope: {
      expectedOutcomes: "A working integration.",
      ...scope,
      deliverables: ((scope.deliverables as PayloadSection[] | undefined) ?? [{ name: "Final report" }]).map((d) => ({
        name: d.name ?? d.description,
        ...d,
      })),
    },
    resources: {
      ipExpected: "no",
      ...(p.resources?.caiasResourcesRequired
        ? { resourceTypeCodes: ["laboratory"], resourceItems: [{ resource: "Test Lab", purpose: "Testing" }] }
        : {}),
      ...p.resources,
    },
    declaration: {
      informationAccurate: true,
      undertakenThroughCaias: true,
      agreementExecuted: true,
      paymentsRouted: true,
      resourcesAsDeclared: true,
      ...p.declaration,
    },
  } as T;
}

/** Adds the portal-spec-v2 closure fields (final progress, outcome, financial statement, declaration) around a test's closure request. */
export function withClosureDefaults<T extends Record<string, unknown>>(body: T): T {
  return {
    finalProgressPercent: 100,
    finalOutcome: "completed_successfully",
    fullPaymentReceived: true,
    ...body,
    declaration: {
      activitiesCompleted: true,
      deliverablesRecorded: true,
      documentsUploaded: true,
      financialsReported: true,
      informationTrue: true,
      ...(body.declaration as Record<string, boolean> | undefined),
    },
  };
}

let closureFinanceCookie: string | null = null;

/** Finance's confirmation of a pending closure (Screen 23) — required by the closure gate before "verified". */
export async function financeVerifyClosure(consultancyId: string, closureId: string) {
  if (!closureFinanceCookie) {
    const { createTestSessionCookie } = await import("./session");
    const finance = await upsertTestUser({
      keycloakSub: "test-finance-closure-verifier",
      name: "Closure Finance Verifier",
      email: "test.finance.closure@caias.in",
      roles: ["finance"],
    });
    closureFinanceCookie = await createTestSessionCookie({ userId: finance.id, roles: ["finance"] });
  }
  const res = await fetch(`${BASE_URL}/api/consultancies/${consultancyId}/closures/${closureId}/finance-verification`, {
    method: "POST",
    headers: { cookie: closureFinanceCookie, "content-type": "application/json" },
    body: JSON.stringify({ status: "verified" }),
  });
  if (res.status !== 200) throw new Error(`finance verification failed: ${res.status} ${await res.text()}`);
}
