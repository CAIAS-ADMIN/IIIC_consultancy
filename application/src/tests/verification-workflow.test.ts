import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createTestSessionCookie } from "./helpers/session";
import { upsertTestUser, upsertTestDepartment, upsertTestApprovalStageConfig, BASE_URL, withRegistrationDefaults } from "./helpers/fixtures";
import { closeDb, db } from "@/db";
import { documents, consultancies } from "@/db/schema";

let facultyCookie: string;
let hodCookie: string;
let hodId: string;
let facultyId: string;

/** An HOD only acts on their own department's records — each test here makes its own department. */
function hodCookieFor(departmentId: string) {
  return createTestSessionCookie({ userId: hodId, roles: ["hod"], departmentId });
}
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
  facultyId = faculty.id;
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
  hodId = hod.id;
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
  return withRegistrationDefaults({
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
  });
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

  const wrongRole = await verify(submitted.id, await hodCookieFor(department.id), { decision: "verify" });
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

  // Only the stage's approver (or a CAIAS admin, who may act at any stage) can decide it.
  const outOfOrder = await verify(submitted.id, otherFacultyCookie, { decision: "verify" });
  assert.equal(outOfOrder.status, 403);

  const hodPass = await verify(submitted.id, await hodCookieFor(department.id), { decision: "verify" });
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
  const hodPass = await verify(submitted.id, await hodCookieFor(department.id), { decision: "verify" });
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
  const res = await verify(submitted.id, await hodCookieFor(department.id), {
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

  const returnRes = await verify(submitted.id, await hodCookieFor(department.id), {
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
  const finalVerify = await verify(submitted.id, await hodCookieFor(department.id), { decision: "verify" });
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
  const rejectRes = await verify(submitted.id, await hodCookieFor(department.id), { decision: "reject", comments: "Not viable" });
  assert.equal(rejectRes.status, 200);
  const rejected = (await rejectRes.json()).data;
  assert.equal(rejected.status, "rejected");

  const cannotReverify = await verify(submitted.id, await hodCookieFor(department.id), { decision: "verify" });
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

  const res = await verify(draft.id, await hodCookieFor(department.id), { decision: "verify" });
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

async function stageConfig(departmentId: string, stages: { stage: string; approverRole: "hod" | "iiic_admin" }[]) {
  for (const [i, s] of stages.entries()) {
    await upsertTestApprovalStageConfig({ id: randomUUID(), departmentId, stage: s.stage, sequence: i + 1, approverRole: s.approverRole });
  }
}

test("an HOD only sees and verifies their own department's consultancies", async () => {
  const department = await upsertTestDepartment({ code: "VWF-HOD-OWN", name: "HOD Own Test Dept" });
  const otherDepartment = await upsertTestDepartment({ code: "VWF-HOD-OTHER", name: "HOD Other Test Dept" });
  await stageConfig(department.id, [{ stage: "hod_verification_pending", approverRole: "hod" }]);
  const submitted = await createAndSubmit(department.id);

  const otherHod = await hodCookieFor(otherDepartment.id);
  const view = await fetch(`${BASE_URL}/api/consultancies/${submitted.id}`, { headers: { cookie: otherHod } });
  assert.equal(view.status, 404);
  const verifyOther = await verify(submitted.id, otherHod, { decision: "verify" });
  assert.equal(verifyOther.status, 403);
  // An HOD with no department on record is not an institution-wide HOD.
  const verifyNoDept = await verify(submitted.id, hodCookie, { decision: "verify" });
  assert.equal(verifyNoDept.status, 403);

  const ownHod = await hodCookieFor(department.id);
  const ownView = await fetch(`${BASE_URL}/api/consultancies/${submitted.id}`, { headers: { cookie: ownHod } });
  assert.equal(ownView.status, 200);
  const verifyOwn = await verify(submitted.id, ownHod, { decision: "verify" });
  assert.equal(verifyOwn.status, 200);
});

test("a CAIAS admin can decide at any stage, e.g. reject a submission still at HOD verification", async () => {
  const department = await upsertTestDepartment({ code: "VWF-ADMIN-ANY", name: "Admin Any Stage Test Dept" });
  await stageConfig(department.id, [
    { stage: "hod_verification_pending", approverRole: "hod" },
    { stage: "caias_verification_pending", approverRole: "iiic_admin" },
  ]);
  const submitted = await createAndSubmit(department.id);
  assert.equal(submitted.workflowStage, "hod_verification_pending");

  const res = await verify(submitted.id, iiicAdminCookie, { decision: "reject", comments: "Wrong client details" });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).data.status, "rejected");
});

test("a CAIAS admin can send a submission back to draft for full re-edit; resubmission keeps its Consultancy ID", async () => {
  const department = await upsertTestDepartment({ code: "VWF-SENDBACK", name: "Send Back Test Dept" });
  await stageConfig(department.id, [{ stage: "hod_verification_pending", approverRole: "hod" }]);
  const submitted = await createAndSubmit(department.id);
  const sendBack = (cookie: string, body: Record<string, unknown>) =>
    fetch(`${BASE_URL}/api/consultancies/${submitted.id}/send-back`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  assert.equal((await sendBack(facultyCookie, { reason: "x" })).status, 403);
  assert.equal((await sendBack(iiicAdminCookie, {})).status, 400);
  const res = await sendBack(iiicAdminCookie, { reason: "Please correct the client address" });
  assert.equal(res.status, 200);
  const draft = (await res.json()).data;
  assert.equal(draft.status, "draft");
  assert.equal(draft.isLocked, false);
  assert.equal(draft.consultancyCode, submitted.consultancyCode);

  // The admin can edit any section of the draft now (not just flagged fields)…
  const patch = await fetch(`${BASE_URL}/api/consultancies/${submitted.id}`, {
    method: "PATCH",
    headers: { cookie: iiicAdminCookie, "content-type": "application/json" },
    body: JSON.stringify({ title: "Corrected by CAIAS admin", client: { city: "Bengaluru" } }),
  });
  assert.equal(patch.status, 200);

  // …and the faculty member resubmits it under the same Consultancy ID.
  const resubmit = await fetch(`${BASE_URL}/api/consultancies/${submitted.id}/submit`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify(validSubmitPayload(department.id)),
  });
  assert.equal(resubmit.status, 200);
  const again = (await resubmit.json()).data;
  assert.equal(again.status, "submitted");
  assert.equal(again.consultancyCode, submitted.consultancyCode);

  assert.equal((await sendBack(iiicAdminCookie, { reason: "again" })).status, 200);
});

test("a CAIAS admin registering on a faculty member's behalf makes that faculty member the one in charge", async () => {
  const department = await upsertTestDepartment({ code: "VWF-ONBEHALF", name: "On Behalf Test Dept" });
  const draftBody = {
    departmentId: department.id,
    academicYearCode: "2025-26",
    consultancyTypeCode: "individual_faculty",
    teamTypeCode: "single_faculty",
    title: "On-behalf Test Consultancy",
    consultancyAreaCode: "artificial_intelligence",
  };
  const create = (cookie: string, facultyInChargeId: string) =>
    fetch(`${BASE_URL}/api/consultancies`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ ...draftBody, facultyInChargeId }),
    });

  const byAdmin = await create(iiicAdminCookie, facultyId);
  assert.equal(byAdmin.status, 201);
  const adminDraft = (await byAdmin.json()).data;
  assert.equal(adminDraft.facultyInChargeId, facultyId);

  // The faculty member can continue the draft the admin started for them.
  const facultyPatch = await fetch(`${BASE_URL}/api/consultancies/${adminDraft.id}`, {
    method: "PATCH",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ title: "Continued by the faculty member" }),
  });
  assert.equal(facultyPatch.status, 200);

  assert.equal((await create(iiicAdminCookie, randomUUID())).status, 400);

  // Anyone else's facultyInChargeId is ignored — the record stays theirs.
  const byFaculty = await create(otherFacultyCookie, facultyId);
  assert.equal(byFaculty.status, 201);
  assert.notEqual((await byFaculty.json()).data.facultyInChargeId, facultyId);
});

test("a draft can be created from the wizard's first screen with only department and academic year", async () => {
  const department = await upsertTestDepartment({ code: "VWF-EARLY-DRAFT", name: "Early Draft Test Dept" });
  const res = await fetch(`${BASE_URL}/api/consultancies`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    // The wizard sends not-yet-filled fields as empty strings.
    body: JSON.stringify({ departmentId: department.id, academicYearCode: "2025-26", title: "", consultancyTypeCode: "", consultancyAreaCode: "" }),
  });
  assert.equal(res.status, 201);
  const draft = (await res.json()).data;
  assert.equal(draft.status, "draft");

  const missingYear = await fetch(`${BASE_URL}/api/consultancies`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ departmentId: department.id }),
  });
  assert.equal(missingYear.status, 400);
});

test("an uploaded document can be removed while the consultancy is a draft, but not after submission or by an unrelated user", async () => {
  const department = await upsertTestDepartment({ code: "VWF-DOC-REMOVE", name: "Doc Remove Test Dept" });
  const draftRes = await fetch(`${BASE_URL}/api/consultancies`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ departmentId: department.id, academicYearCode: "2025-26" }),
  });
  const draft = (await draftRes.json()).data;
  const [doc] = await db
    .insert(documents)
    .values({
      consultancyId: draft.id,
      documentCategory: "Technical Proposal",
      originalFileName: "wrong-file.pdf",
      objectKey: `consultancies/${draft.id}/wrong-file.pdf`,
      status: "available",
      uploadedBy: draft.createdBy,
    })
    .returning();
  const remove = (id: string, cookie: string) => fetch(`${BASE_URL}/api/documents/${id}`, { method: "DELETE", headers: { cookie } });

  assert.equal((await remove(doc.id, otherFacultyCookie)).status, 403);
  assert.equal((await remove(doc.id, facultyCookie)).status, 200);
  assert.equal(await db.query.documents.findFirst({ where: eq(documents.id, doc.id) }), undefined);

  const submitted = await createAndSubmit(department.id);
  const agreement = await db.query.documents.findFirst({ where: eq(documents.consultancyId, submitted.id) });
  assert.ok(agreement);
  assert.equal((await remove(agreement.id, facultyCookie)).status, 409);
});

test("registration / progress / closure records download as letterhead PDFs, only for people who can view the consultancy", async () => {
  const department = await upsertTestDepartment({ code: "VWF-PDF", name: "PDF Record Test Dept" });
  const submitted = await createAndSubmit(department.id);
  const get = (kind: string, cookie: string) => fetch(`${BASE_URL}/api/consultancies/${submitted.id}/records/${kind}`, { headers: { cookie } });

  const res = await get("registration", facultyCookie);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/pdf");
  assert.match(res.headers.get("content-disposition") ?? "", /registration-record\.pdf/);
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert.ok(bytes.length > 20_000, "includes the letterhead image and embedded font");

  assert.equal((await get("progress", facultyCookie)).status, 200);
  assert.equal((await get("closure", facultyCookie)).status, 200);
  assert.equal((await get("nonsense", facultyCookie)).status, 404);
  assert.equal((await get("registration", otherFacultyCookie)).status, 404);
});
