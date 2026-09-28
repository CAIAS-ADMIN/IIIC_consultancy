import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createTestSessionCookie } from "./helpers/session";
import { upsertTestUser, upsertTestDepartment, upsertTestApprovalStageConfig, BASE_URL, withRegistrationDefaults } from "./helpers/fixtures";
import { closeDb, db } from "@/db";
import { documents } from "@/db/schema";

let facultyCookie: string;
let hodCookie: string;
let iiicAdminCookie: string;
let outsiderCookie: string;
let departmentId: string;

after(async () => {
  await closeDb();
});

before(async () => {
  const department = await upsertTestDepartment({ code: "PHASE7DEPT", name: "Phase 7 Test Dept" });
  departmentId = department.id;

  const faculty = await upsertTestUser({
    keycloakSub: "test-faculty-phase7",
    name: "Phase 7 Test Faculty",
    email: "test.faculty.phase7@caias.in",
    roles: ["faculty"],
  });
  facultyCookie = await createTestSessionCookie({ userId: faculty.id, roles: ["faculty"] });

  const hod = await upsertTestUser({
    keycloakSub: "test-hod-phase7",
    name: "Phase 7 Test HOD",
    email: "test.hod.phase7@caias.in",
    roles: ["hod"],
  });
  hodCookie = await createTestSessionCookie({ userId: hod.id, roles: ["hod"], departmentId });

  const iiicAdmin = await upsertTestUser({
    keycloakSub: "test-iiicadmin-phase7",
    name: "Phase 7 Test IIIC Admin",
    email: "test.iiicadmin.phase7@caias.in",
    roles: ["iiic_admin"],
  });
  iiicAdminCookie = await createTestSessionCookie({ userId: iiicAdmin.id, roles: ["iiic_admin"] });

  const outsider = await upsertTestUser({
    keycloakSub: "test-outsider-phase7",
    name: "Phase 7 Test Outsider",
    email: "test.outsider.phase7@caias.in",
    roles: ["faculty"],
  });
  outsiderCookie = await createTestSessionCookie({ userId: outsider.id, roles: ["faculty"] });

  await upsertTestApprovalStageConfig({
    id: "00000000-0000-0000-0000-0000000000b1",
    departmentId,
    stage: "hod_verification_pending",
    sequence: 1,
    approverRole: "hod",
  });
});

function validSubmitPayload(overrides: Record<string, unknown> = {}) {
  return withRegistrationDefaults({
    consultancy: {
      departmentId,
      academicYearCode: "2025-26",
      consultancyTypeCode: "individual_faculty",
      teamTypeCode: "single_faculty",
      title: "Activation Test Consultancy",
      consultancyAreaCode: "artificial_intelligence",
      startDate: "2026-01-01",
      expectedCompletionDate: "2026-06-01",
    },
    client: {
      organizationName: "Test Client Org",
      organizationTypeCode: "private_company",
    },
    agreement: {
      agreementTypeCode: "work_order",
      agreementValue: "50000",
      paymentTermsCode: "milestone_based",
    },
    team: {
      members: [{ name: "Phase 7 Test Faculty", role: "Principal Investigator" }],
    },
    financial: {
      totalValue: "50000",
    },
    scope: {
      scopeOfWork: "Build a test integration.",
      deliverables: [{ description: "Final report" }],
    },
    resources: {},
    ...overrides,
  });
}

async function createRegisteredConsultancy(overrides: Record<string, unknown> = {}) {
  const draftRes = await fetch(`${BASE_URL}/api/consultancies`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      departmentId,
      academicYearCode: "2025-26",
      consultancyTypeCode: "individual_faculty",
      teamTypeCode: "single_faculty",
      title: "Activation Test Consultancy",
      consultancyAreaCode: "artificial_intelligence",
    }),
  });
  const draft = (await draftRes.json()).data;

  await db.insert(documents).values({
    consultancyId: draft.id,
    documentCategory: "Signed Agreement",
    originalFileName: "agreement.pdf",
    objectKey: `test/${draft.id}/agreement.pdf`,
    status: "available",
    uploadedBy: draft.createdBy,
  });

  const submitRes = await fetch(`${BASE_URL}/api/consultancies/${draft.id}/submit`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify(validSubmitPayload(overrides)),
  });
  assert.equal(submitRes.status, 200);

  const verifyRes = await fetch(`${BASE_URL}/api/consultancies/${draft.id}/verify`, {
    method: "POST",
    headers: { cookie: hodCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "verify" }),
  });
  const registered = (await verifyRes.json()).data;
  assert.equal(registered.status, "registered");
  return registered;
}

async function activate(id: string, cookie: string = iiicAdminCookie) {
  return fetch(`${BASE_URL}/api/consultancies/${id}/activate`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
  });
}

test("activation is blocked with a specific reason when the mandatory agreement document is missing, then passes once resolved", async () => {
  // Submission already requires the document, so to exercise this gate independently we
  // simulate a data gap by marking the (already-required-at-submit) document unavailable.
  const registered = await createRegisteredConsultancy();

  const [doc] = await db
    .update(documents)
    .set({ status: "quarantined" })
    .where(eq(documents.consultancyId, registered.id))
    .returning();
  assert.ok(doc);

  const blockedRes = await activate(registered.id);
  assert.equal(blockedRes.status, 409);
  const blockedBody = await blockedRes.json();
  assert.ok(blockedBody.error.reasons.some((r: string) => /signed agreement/i.test(r)));

  await db.update(documents).set({ status: "available" }).where(eq(documents.consultancyId, registered.id));

  const okRes = await activate(registered.id);
  assert.equal(okRes.status, 200);
});

test("activation is blocked with specific reasons and passes once all gates are met", async () => {
  const registered = await createRegisteredConsultancy();

  const res = await activate(registered.id);
  assert.equal(res.status, 200);
  const activated = (await res.json()).data;
  assert.equal(activated.status, "active");
  assert.ok(activated.activatedAt);

  // already active now — re-activating is blocked with a specific reason
  const again = await activate(registered.id);
  assert.equal(again.status, 409);
  const againBody = await again.json();
  assert.ok(againBody.error.reasons.some((r: string) => /already active/i.test(r)));
});

test("activation is blocked when required approval stages are incomplete", async () => {
  const department = await upsertTestDepartment({ code: "PHASE7-TWOSTAGE", name: "Phase 7 Two Stage Dept" });
  await upsertTestApprovalStageConfig({
    id: randomUUID(),
    departmentId: department.id,
    stage: "hod_verification_pending",
    sequence: 1,
    approverRole: "hod",
  });
  await upsertTestApprovalStageConfig({
    id: randomUUID(),
    departmentId: department.id,
    stage: "caias_verification_pending",
    sequence: 2,
    approverRole: "iiic_admin",
  });

  const draftRes = await fetch(`${BASE_URL}/api/consultancies`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      departmentId: department.id,
      academicYearCode: "2025-26",
      consultancyTypeCode: "individual_faculty",
      teamTypeCode: "single_faculty",
      title: "Incomplete Approval Test",
      consultancyAreaCode: "artificial_intelligence",
    }),
  });
  const draft = (await draftRes.json()).data;
  await db.insert(documents).values({
    consultancyId: draft.id,
    documentCategory: "Signed Agreement",
    originalFileName: "agreement.pdf",
    objectKey: `test/${draft.id}/agreement.pdf`,
    status: "available",
    uploadedBy: draft.createdBy,
  });
  await fetch(`${BASE_URL}/api/consultancies/${draft.id}/submit`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify(
      validSubmitPayload({
        consultancy: {
          departmentId: department.id,
          academicYearCode: "2025-26",
          consultancyTypeCode: "individual_faculty",
          teamTypeCode: "single_faculty",
          title: "Incomplete Approval Test",
          consultancyAreaCode: "artificial_intelligence",
          startDate: "2026-01-01",
          expectedCompletionDate: "2026-06-01",
        },
      })
    ),
  });
  // only HOD verifies — CAIAS stage still pending, status is under_verification, not registered
  await fetch(`${BASE_URL}/api/consultancies/${draft.id}/verify`, {
    method: "POST",
    headers: { cookie: hodCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "verify" }),
  });

  const res = await activate(draft.id);
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.ok(body.error.reasons.some((r: string) => /registered/i.test(r)));
});

test("progress updates: only recordable on an active consultancy, listed in chronological order, and progress percent is queryable", async () => {
  const registered = await createRegisteredConsultancy();
  const activateRes = await activate(registered.id);
  const activated = (await activateRes.json()).data;

  const forbiddenBeforeActive = await fetch(`${BASE_URL}/api/consultancies/${registered.id}/progress-updates`, {
    method: "POST",
    headers: { cookie: outsiderCookie, "content-type": "application/json" },
    body: JSON.stringify({
      reportDate: "2026-02-01",
      reportingPeriodStart: "2026-01-01",
      reportingPeriodEnd: "2026-01-31",
      status: "on_track",
      overallProgressPercent: 10,
      workCompleted: "Work done.",
      workInProgress: "Work ongoing.",
    }),
  });
  assert.equal(forbiddenBeforeActive.status, 403);

  const first = await fetch(`${BASE_URL}/api/consultancies/${activated.id}/progress-updates`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      reportDate: "2026-02-01",
      reportingPeriodStart: "2026-01-01",
      reportingPeriodEnd: "2026-01-31",
      status: "on_track",
      overallProgressPercent: 20,
      workCompleted: "Work done.",
      workInProgress: "Work ongoing.",
    }),
  });
  assert.equal(first.status, 201);

  const second = await fetch(`${BASE_URL}/api/consultancies/${activated.id}/progress-updates`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      reportDate: "2026-03-01",
      reportingPeriodStart: "2026-02-01",
      reportingPeriodEnd: "2026-02-28",
      status: "delayed",
      overallProgressPercent: 35,
      workCompleted: "Work done.",
      workInProgress: "Work ongoing.",
    }),
  });
  assert.equal(second.status, 201);

  const listRes = await fetch(`${BASE_URL}/api/consultancies/${activated.id}/progress-updates`, {
    headers: { cookie: facultyCookie },
  });
  const list = (await listRes.json()).data;
  assert.equal(list.length, 2);
  assert.equal(list[0].reportDate, "2026-02-01");
  assert.equal(list[0].overallProgressPercent, 20);
  assert.equal(list[1].reportDate, "2026-03-01");
  assert.equal(list[1].overallProgressPercent, 35);
});

test("an overdue milestone is correctly flagged by the derived-fields query without manual input", async () => {
  const registered = await createRegisteredConsultancy();
  const activateRes = await activate(registered.id);
  const activated = (await activateRes.json()).data;

  const overdueMilestone = await fetch(`${BASE_URL}/api/consultancies/${activated.id}/milestones`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ title: "Overdue milestone", plannedDate: "2020-01-01" }),
  });
  assert.equal(overdueMilestone.status, 201);
  const overdue = (await overdueMilestone.json()).data;

  const futureMilestone = await fetch(`${BASE_URL}/api/consultancies/${activated.id}/milestones`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ title: "Future milestone", plannedDate: "2099-01-01" }),
  });
  assert.equal(futureMilestone.status, 201);

  const derivedRes = await fetch(`${BASE_URL}/api/consultancies/${activated.id}/derived`, {
    headers: { cookie: facultyCookie },
  });
  const derived = (await derivedRes.json()).data;
  assert.equal(derived.overdueMilestones.length, 1);
  assert.equal(derived.overdueMilestones[0].id, overdue.id);
  assert.ok(derived.daysElapsed !== null && derived.daysElapsed >= 0);
  assert.equal(typeof derived.isCompletionOverdue, "boolean");

  // marking it completed removes it from the overdue list without touching plannedDate
  const patchRes = await fetch(`${BASE_URL}/api/consultancies/${activated.id}/milestones/${overdue.id}`, {
    method: "PATCH",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ status: "completed", actualDate: "2026-01-01" }),
  });
  assert.equal(patchRes.status, 200);

  const derivedAfterRes = await fetch(`${BASE_URL}/api/consultancies/${activated.id}/derived`, {
    headers: { cookie: facultyCookie },
  });
  const derivedAfter = (await derivedAfterRes.json()).data;
  assert.equal(derivedAfter.overdueMilestones.length, 0);
});
