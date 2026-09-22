import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSessionCookie } from "./helpers/session";
import { upsertTestUser, upsertTestDepartment, upsertTestApprovalStageConfig, BASE_URL } from "./helpers/fixtures";
import { closeDb, db } from "@/db";
import { documents } from "@/db/schema";

let facultyCookie: string;
let facultyId: string;
let departmentId: string;

after(async () => {
  await closeDb();
});

before(async () => {
  const department = await upsertTestDepartment({ code: "TESTDEPT", name: "Test Department" });
  departmentId = department.id;
  const faculty = await upsertTestUser({
    keycloakSub: "test-faculty-registration",
    name: "Registration Test Faculty",
    email: "test.faculty.registration@caias.in",
    roles: ["faculty"],
  });
  facultyId = faculty.id;
  facultyCookie = await createTestSessionCookie({ userId: faculty.id, roles: ["faculty"] });

  // A single required verification stage, so a successful submit lands in
  // `submitted` (not auto-registered) — matches this file's pre-Phase-6 assumptions.
  await upsertTestApprovalStageConfig({
    id: "00000000-0000-0000-0000-0000000000a1",
    departmentId,
    stage: "hod_verification_pending",
    sequence: 1,
    approverRole: "hod",
  });
});

async function createDraft() {
  const res = await fetch(`${BASE_URL}/api/consultancies`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      departmentId,
      academicYearCode: "2025-26",
      consultancyTypeCode: "individual_faculty",
      teamTypeCode: "single_faculty",
      title: "Integration Test Consultancy",
      consultancyAreaCode: "artificial_intelligence",
    }),
  });
  assert.equal(res.status, 201);
  return (await res.json()).data;
}

function validSubmitPayload(overrides: Record<string, unknown> = {}) {
  return {
    consultancy: {
      departmentId,
      academicYearCode: "2025-26",
      consultancyTypeCode: "individual_faculty",
      teamTypeCode: "single_faculty",
      title: "Integration Test Consultancy",
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
      members: [{ name: "Registration Test Faculty", role: "Principal Investigator" }],
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
  };
}

test("createDraftConsultancy saves a draft with incomplete data", async () => {
  const draft = await createDraft();
  assert.equal(draft.status, "draft");
  assert.equal(draft.consultancyCode, null);
});

test("submit fails with clear field-level errors when required fields are missing", async () => {
  const draft = await createDraft();
  const res = await fetch(`${BASE_URL}/api/consultancies/${draft.id}/submit`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error);
});

test("submit fails with a conditional error when Organization Type is Other but not specified", async () => {
  const draft = await createDraft();
  const payload = validSubmitPayload({
    client: { organizationName: "Test Client Org", organizationTypeCode: "other" },
  });
  const res = await fetch(`${BASE_URL}/api/consultancies/${draft.id}/submit`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(res.status, 400);
});

test("submit is blocked until the mandatory signed agreement document exists, then succeeds with a formatted Consultancy ID", async () => {
  const draft = await createDraft();
  const payload = validSubmitPayload();

  const blockedRes = await fetch(`${BASE_URL}/api/consultancies/${draft.id}/submit`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(blockedRes.status, 400);
  const blockedBody = await blockedRes.json();
  assert.match(String(blockedBody.error), /signed agreement/i);

  await db.insert(documents).values({
    consultancyId: draft.id,
    documentCategory: "Signed Agreement",
    originalFileName: "agreement.pdf",
    objectKey: `consultancies/${draft.id}/signed-agreement/v1.pdf`,
    uploadedBy: facultyId,
    status: "available",
  });

  const okRes = await fetch(`${BASE_URL}/api/consultancies/${draft.id}/submit`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(okRes.status, 200);
  const submitted = (await okRes.json()).data;
  assert.equal(submitted.status, "submitted");
  assert.match(submitted.consultancyCode, /^CAIAS\/CON\/2025-26\/\d{5}$/);

  // Submitted record cannot be edited via the ordinary PATCH path.
  const patchRes = await fetch(`${BASE_URL}/api/consultancies/${draft.id}`, {
    method: "PATCH",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ title: "Should not apply" }),
  });
  assert.equal(patchRes.status, 409);
});

test("two concurrent submissions never produce a duplicate Consultancy ID", async () => {
  const [draftA, draftB] = await Promise.all([createDraft(), createDraft()]);

  await db.insert(documents).values([
    {
      consultancyId: draftA.id,
      documentCategory: "Signed Agreement",
      originalFileName: "a.pdf",
      objectKey: `consultancies/${draftA.id}/signed-agreement/v1.pdf`,
      uploadedBy: facultyId,
      status: "available",
    },
    {
      consultancyId: draftB.id,
      documentCategory: "Signed Agreement",
      originalFileName: "b.pdf",
      objectKey: `consultancies/${draftB.id}/signed-agreement/v1.pdf`,
      uploadedBy: facultyId,
      status: "available",
    },
  ]);

  const submit = (id: string) =>
    fetch(`${BASE_URL}/api/consultancies/${id}/submit`, {
      method: "POST",
      headers: { cookie: facultyCookie, "content-type": "application/json" },
      body: JSON.stringify(validSubmitPayload()),
    }).then((r) => r.json());

  const [resultA, resultB] = await Promise.all([submit(draftA.id), submit(draftB.id)]);
  assert.notEqual(resultA.data.consultancyCode, resultB.data.consultancyCode);
});

test("Agreement Date cannot be later than the submission date", async () => {
  const draft = await createDraft();
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const payload = validSubmitPayload({
    agreement: {
      agreementTypeCode: "work_order",
      agreementValue: "50000",
      paymentTermsCode: "milestone_based",
      agreementDate: futureDate,
    },
  });
  const res = await fetch(`${BASE_URL}/api/consultancies/${draft.id}/submit`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(res.status, 400);
});

test("Expected Completion Date cannot precede Start Date", async () => {
  const draft = await createDraft();
  const payload = validSubmitPayload({
    consultancy: {
      departmentId,
      academicYearCode: "2025-26",
      consultancyTypeCode: "individual_faculty",
      teamTypeCode: "single_faculty",
      title: "Integration Test Consultancy",
      consultancyAreaCode: "artificial_intelligence",
      startDate: "2026-06-01",
      expectedCompletionDate: "2026-01-01",
    },
  });
  const res = await fetch(`${BASE_URL}/api/consultancies/${draft.id}/submit`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(res.status, 400);
});
