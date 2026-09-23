import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createTestSessionCookie } from "./helpers/session";
import { upsertTestUser, upsertTestDepartment, upsertTestApprovalStageConfig, BASE_URL } from "./helpers/fixtures";
import { closeDb, db } from "@/db";
import { documents, consultancies } from "@/db/schema";

let facultyCookie: string;
let hodCookie: string;
let iiicAdminCookie: string;
let systemAdminCookie: string;
let otherFacultyCookie: string;

after(async () => {
  await closeDb();
});

before(async () => {
  const faculty = await upsertTestUser({
    keycloakSub: "test-faculty-verify",
    name: "Verify Test Faculty",
    email: "test.faculty.verify@caias.in",
    roles: ["faculty"],
  });
  facultyCookie = await createTestSessionCookie({ userId: faculty.id, roles: ["faculty"] });

  const otherFaculty = await upsertTestUser({
    keycloakSub: "test-other-faculty-verify",
    name: "Other Verify Test Faculty",
    email: "test.other.faculty.verify@caias.in",
    roles: ["faculty"],
  });
  otherFacultyCookie = await createTestSessionCookie({ userId: otherFaculty.id, roles: ["faculty"] });

  const hod = await upsertTestUser({
    keycloakSub: "test-hod-verify",
    name: "Verify Test HOD",
    email: "test.hod.verify@caias.in",
    roles: ["hod"],
  });
  hodCookie = await createTestSessionCookie({ userId: hod.id, roles: ["hod"] });

  const iiicAdmin = await upsertTestUser({
    keycloakSub: "test-iiicadmin-verify",
    name: "Verify Test IIIC Admin",
    email: "test.iiicadmin.verify@caias.in",
    roles: ["iiic_admin"],
  });
  iiicAdminCookie = await createTestSessionCookie({ userId: iiicAdmin.id, roles: ["iiic_admin"] });

  const systemAdmin = await upsertTestUser({
    keycloakSub: "test-sysadmin-verify",
    name: "Verify Test System Admin",
    email: "test.sysadmin.verify@caias.in",
    roles: ["system_admin"],
  });
  systemAdminCookie = await createTestSessionCookie({ userId: systemAdmin.id, roles: ["system_admin"] });
});

function validSubmitPayload(departmentId: string, overrides: Record<string, unknown> = {}) {
  return {
    consultancy: {
      departmentId,
      academicYearCode: "2025-26",
      consultancyTypeCode: "individual_faculty",
      teamTypeCode: "single_faculty",
      title: "Verification Workflow Test Consultancy",
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
      members: [{ name: "Verify Test Faculty", role: "Principal Investigator" }],
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

async function createAndSubmit(departmentId: string, cookie: string = facultyCookie) {
  const draftRes = await fetch(`${BASE_URL}/api/consultancies`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({
      departmentId,
      academicYearCode: "2025-26",
      consultancyTypeCode: "individual_faculty",
      teamTypeCode: "single_faculty",
      title: "Verification Workflow Test Consultancy",
      consultancyAreaCode: "artificial_intelligence",
    }),
  });
  assert.equal(draftRes.status, 201);
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
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(validSubmitPayload(departmentId)),
  });
  assert.equal(submitRes.status, 200);
  return (await submitRes.json()).data;
}

async function verify(id: string, cookie: string, body: Record<string, unknown>) {
  return fetch(`${BASE_URL}/api/consultancies/${id}/verify`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("a consultancy with only CAIAS Verification configured skips HOD entirely", async () => {
  const department = await upsertTestDepartment({ code: "VWF-CAIAS-ONLY", name: "CAIAS-only Test Dept" });
  await upsertTestApprovalStageConfig({
    id: randomUUID(),
    departmentId: department.id,
    stage: "caias_verification_pending",
    sequence: 1,
    approverRole: "iiic_admin",
  });

  const submitted = await createAndSubmit(department.id);
  assert.equal(submitted.status, "submitted");
  assert.equal(submitted.workflowStage, "caias_verification_pending");

  const wrongRole = await verify(submitted.id, hodCookie, { decision: "verify" });
  assert.equal(wrongRole.status, 403);

  const res = await verify(submitted.id, iiicAdminCookie, { decision: "verify" });
  assert.equal(res.status, 200);
  const body = (await res.json()).data;
  assert.equal(body.status, "registered");
  assert.equal(body.workflowStage, "verification_complete");
  assert.ok(body.registeredAt);
});

test("a consultancy with both HOD and CAIAS Verification configured requires both, in order", async () => {
  const department = await upsertTestDepartment({ code: "VWF-BOTH", name: "Both-stage Test Dept" });
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

  const submitted = await createAndSubmit(department.id);
  assert.equal(submitted.workflowStage, "hod_verification_pending");

  const outOfOrder = await verify(submitted.id, iiicAdminCookie, { decision: "verify" });
  assert.equal(outOfOrder.status, 403);

  const hodPass = await verify(submitted.id, hodCookie, { decision: "verify" });
  assert.equal(hodPass.status, 200);
  const afterHod = (await hodPass.json()).data;
  assert.equal(afterHod.status, "under_verification");
  assert.equal(afterHod.workflowStage, "caias_verification_pending");

  const caiasPass = await verify(submitted.id, iiicAdminCookie, { decision: "verify" });
  assert.equal(caiasPass.status, 200);
  const final = (await caiasPass.json()).data;
  assert.equal(final.status, "registered");
});

test("a value-range-bounded stage is skipped when the consultancy's value falls outside it", async () => {
  const department = await upsertTestDepartment({ code: "VWF-VALUE", name: "Value-bounded Test Dept" });
  await upsertTestApprovalStageConfig({
    id: randomUUID(),
    departmentId: department.id,
    stage: "hod_verification_pending",
    sequence: 1,
    approverRole: "hod",
  });
  // Only applies above 1,000,000 — the test payload's totalValue is 50,000, so this must not gate.
  await upsertTestApprovalStageConfig({
    id: randomUUID(),
    departmentId: department.id,
    stage: "competent_authority_approval_pending",
    sequence: 2,
    approverRole: "competent_authority",
    minValue: "1000000",
  });

  const submitted = await createAndSubmit(department.id);
  const hodPass = await verify(submitted.id, hodCookie, { decision: "verify" });
  const final = (await hodPass.json()).data;
  assert.equal(final.status, "registered");
  assert.equal(final.workflowStage, "verification_complete");
});

test("return for clarification rejects a flaggedFields value that isn't a real top-level consultancy field", async () => {
  const department = await upsertTestDepartment({ code: "VWF-BADFLAG", name: "Bad Flag Test Dept" });
  await upsertTestApprovalStageConfig({
    id: randomUUID(),
    departmentId: department.id,
    stage: "hod_verification_pending",
    sequence: 1,
    approverRole: "hod",
  });

  const submitted = await createAndSubmit(department.id);
  const res = await verify(submitted.id, hodCookie, {
    decision: "return",
    comments: "typo'd field name",
    flaggedFields: ["consultancyTitle"], // not a real column (the real one is "title")
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(String(body.error), /consultancyTitle/);

  // the consultancy is untouched — still awaiting verification, not clarification_required
  const stillPending = await db.query.consultancies.findFirst({ where: eq(consultancies.id, submitted.id) });
  assert.equal(stillPending?.status, "submitted");
});

test("return for clarification restricts editing to flagged fields, snapshots the prior version, and resubmission re-enters at the returning stage", async () => {
  const department = await upsertTestDepartment({ code: "VWF-CLARIFY", name: "Clarify Test Dept" });
  await upsertTestApprovalStageConfig({
    id: randomUUID(),
    departmentId: department.id,
    stage: "hod_verification_pending",
    sequence: 1,
    approverRole: "hod",
  });

  const submitted = await createAndSubmit(department.id);
  const originalTitle = submitted.title;

  const returnRes = await verify(submitted.id, hodCookie, {
    decision: "return",
    comments: "Please fix the title",
    flaggedFields: ["title"],
  });
  assert.equal(returnRes.status, 200);
  const returned = (await returnRes.json()).data;
  assert.equal(returned.status, "clarification_required");
  assert.deepEqual(returned.flaggedFields, ["title"]);

  // disallowed field rejected
  const disallowed = await fetch(`${BASE_URL}/api/consultancies/${submitted.id}`, {
    method: "PATCH",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ description: "sneaky edit" }),
  });
  assert.equal(disallowed.status, 400);

  // unrelated user forbidden even for the flagged field
  const forbidden = await fetch(`${BASE_URL}/api/consultancies/${submitted.id}`, {
    method: "PATCH",
    headers: { cookie: otherFacultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ title: "Hijacked title" }),
  });
  assert.equal(forbidden.status, 403);

  // owner edits the flagged field successfully
  const allowed = await fetch(`${BASE_URL}/api/consultancies/${submitted.id}`, {
    method: "PATCH",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ title: "Corrected Title" }),
  });
  assert.equal(allowed.status, 200);
  const edited = (await allowed.json()).data;
  assert.equal(edited.title, "Corrected Title");

  // the pre-clarification version is retrievable
  const versionsRes = await fetch(`${BASE_URL}/api/consultancies/${submitted.id}/versions`, {
    headers: { cookie: facultyCookie },
  });
  assert.equal(versionsRes.status, 200);
  const versions = (await versionsRes.json()).data;
  assert.equal(versions.length, 1);
  assert.equal(versions[0].snapshot.consultancy.title, originalTitle);

  const resubmitRes = await fetch(`${BASE_URL}/api/consultancies/${submitted.id}/resubmit`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
  });
  assert.equal(resubmitRes.status, 200);
  const resubmitted = (await resubmitRes.json()).data;
  assert.equal(resubmitted.status, "under_verification");
  assert.equal(resubmitted.workflowStage, "hod_verification_pending");
  assert.equal(resubmitted.currentVersion, 2);
  assert.equal(resubmitted.flaggedFields, null);

  // re-enters at the returning stage's approver, not "from the start"
  const finalVerify = await verify(submitted.id, hodCookie, { decision: "verify" });
  assert.equal(finalVerify.status, 200);
  const finalBody = (await finalVerify.json()).data;
  assert.equal(finalBody.status, "registered");
});

test("rejection locks the record out of the workflow and never lets its Consultancy ID be reused", async () => {
  const department = await upsertTestDepartment({ code: "VWF-REJECT", name: "Reject Test Dept" });
  await upsertTestApprovalStageConfig({
    id: randomUUID(),
    departmentId: department.id,
    stage: "hod_verification_pending",
    sequence: 1,
    approverRole: "hod",
  });

  const submitted = await createAndSubmit(department.id);
  const rejectRes = await verify(submitted.id, hodCookie, { decision: "reject", comments: "Not viable" });
  assert.equal(rejectRes.status, 200);
  const rejected = (await rejectRes.json()).data;
  assert.equal(rejected.status, "rejected");

  const cannotReverify = await verify(submitted.id, hodCookie, { decision: "verify" });
  assert.equal(cannotReverify.status, 409);

  const nextSubmitted = await createAndSubmit(department.id);
  assert.notEqual(nextSubmitted.consultancyCode, rejected.consultancyCode);

  const stillThere = await db.query.consultancies.findFirst({ where: eq(consultancies.id, rejected.id) });
  assert.equal(stillThere?.consultancyCode, rejected.consultancyCode);
});

test("verify is rejected for a consultancy that hasn't been submitted yet", async () => {
  const department = await upsertTestDepartment({ code: "VWF-DRAFT", name: "Draft Test Dept" });
  const draftRes = await fetch(`${BASE_URL}/api/consultancies`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      departmentId: department.id,
      academicYearCode: "2025-26",
      consultancyTypeCode: "individual_faculty",
      teamTypeCode: "single_faculty",
      title: "Draft-only Consultancy",
      consultancyAreaCode: "artificial_intelligence",
    }),
  });
  const draft = (await draftRes.json()).data;

  const res = await verify(draft.id, hodCookie, { decision: "verify" });
  assert.equal(res.status, 409);
});

test("system_admin can verify regardless of the stage's configured approver role", async () => {
  const department = await upsertTestDepartment({ code: "VWF-ADMIN-OVERRIDE", name: "Admin Override Test Dept" });
  await upsertTestApprovalStageConfig({
    id: randomUUID(),
    departmentId: department.id,
    stage: "hod_verification_pending",
    sequence: 1,
    approverRole: "hod",
  });

  const submitted = await createAndSubmit(department.id);
  const res = await verify(submitted.id, systemAdminCookie, { decision: "verify" });
  assert.equal(res.status, 200);
});
