import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSessionCookie } from "./helpers/session";
import { upsertTestUser, upsertTestDepartment, upsertTestApprovalStageConfig, BASE_URL, withRegistrationDefaults } from "./helpers/fixtures";
import { closeDb, db } from "@/db";
import { documents } from "@/db/schema";

let facultyCookie: string;
let hodCookie: string;
let iiicAdminCookie: string;
let departmentId: string;

after(async () => {
  await closeDb();
});

before(async () => {
  const department = await upsertTestDepartment({ code: "PHASE8DEPT", name: "Phase 8 Test Dept" });
  departmentId = department.id;

  const faculty = await upsertTestUser({
    keycloakSub: "test-faculty-phase8",
    name: "Phase 8 Test Faculty",
    email: "test.faculty.phase8@caias.in",
    roles: ["faculty"],
    departmentId,
  });
  facultyCookie = await createTestSessionCookie({ userId: faculty.id, roles: ["faculty"], departmentId });

  const hod = await upsertTestUser({
    keycloakSub: "test-hod-phase8",
    name: "Phase 8 Test HOD",
    email: "test.hod.phase8@caias.in",
    roles: ["hod"],
  });
  hodCookie = await createTestSessionCookie({ userId: hod.id, roles: ["hod"], departmentId });

  const iiicAdmin = await upsertTestUser({
    keycloakSub: "test-iiicadmin-phase8",
    name: "Phase 8 Test IIIC Admin",
    email: "test.iiicadmin.phase8@caias.in",
    roles: ["iiic_admin"],
  });
  iiicAdminCookie = await createTestSessionCookie({ userId: iiicAdmin.id, roles: ["iiic_admin"] });

  await upsertTestApprovalStageConfig({
    id: "00000000-0000-0000-0000-0000000000c1",
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
      title: "Lifecycle Test Consultancy",
      consultancyAreaCode: "artificial_intelligence",
      startDate: "2026-01-01",
      expectedCompletionDate: "2026-06-01",
    },
    client: { organizationName: "Test Client Org", organizationTypeCode: "private_company" },
    agreement: { agreementTypeCode: "work_order", agreementValue: "50000", paymentTermsCode: "milestone_based" },
    team: { members: [{ name: "Phase 8 Test Faculty", role: "Principal Investigator" }] },
    financial: { totalValue: "50000" },
    scope: { scopeOfWork: "Build a test integration.", deliverables: [{ description: "Final report" }] },
    resources: {},
    ...overrides,
  });
}

async function createActiveConsultancy() {
  const draftRes = await fetch(`${BASE_URL}/api/consultancies`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      departmentId,
      academicYearCode: "2025-26",
      consultancyTypeCode: "individual_faculty",
      teamTypeCode: "single_faculty",
      title: "Lifecycle Test Consultancy",
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
    body: JSON.stringify(validSubmitPayload()),
  });
  await fetch(`${BASE_URL}/api/consultancies/${draft.id}/verify`, {
    method: "POST",
    headers: { cookie: hodCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "verify" }),
  });
  const activateRes = await fetch(`${BASE_URL}/api/consultancies/${draft.id}/activate`, {
    method: "POST",
    headers: { cookie: iiicAdminCookie, "content-type": "application/json" },
  });
  const activated = (await activateRes.json()).data;
  assert.equal(activated.status, "active");
  return activated;
}

test("after an approved extension, both the original and revised completion dates are independently visible", async () => {
  const consultancy = await createActiveConsultancy();
  assert.equal(consultancy.originalCompletionDate, "2026-06-01");
  assert.equal(consultancy.currentCompletionDate, "2026-06-01");

  const requestRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/extensions`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      proposedCompletionDate: "2026-09-01",
      reason: "Client requested more time for data collection",
      clientConsent: true,
    }),
  });
  assert.equal(requestRes.status, 201);
  const extension = (await requestRes.json()).data;
  assert.equal(extension.originalCompletionDate, "2026-06-01");
  assert.equal(extension.proposedCompletionDate, "2026-09-01");
  assert.equal(extension.status, "requested");

  const statusAfterRequest = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}`, { headers: { cookie: facultyCookie } });
  assert.equal((await statusAfterRequest.json()).data.consultancy.status, "extension_requested");

  // a second concurrent request is rejected while one is pending
  const secondRequest = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/extensions`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ proposedCompletionDate: "2026-10-01", reason: "another reason" }),
  });
  assert.equal(secondRequest.status, 409);

  const decideRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/extensions/${extension.id}/decide`, {
    method: "POST",
    headers: { cookie: hodCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "approve" }),
  });
  assert.equal(decideRes.status, 200);
  const decided = (await decideRes.json()).data;
  assert.equal(decided.extension.status, "approved");
  assert.equal(decided.consultancy.status, "active");
  assert.equal(decided.consultancy.currentCompletionDate, "2026-09-01");
  assert.equal(decided.consultancy.originalCompletionDate, "2026-06-01");
});

test("a rejected extension leaves the completion date unchanged", async () => {
  const consultancy = await createActiveConsultancy();

  const requestRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/extensions`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ proposedCompletionDate: "2026-12-01", reason: "scope grew" }),
  });
  const extension = (await requestRes.json()).data;

  const decideRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/extensions/${extension.id}/decide`, {
    method: "POST",
    headers: { cookie: hodCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "reject", comments: "Not justified" }),
  });
  const decided = (await decideRes.json()).data;
  assert.equal(decided.extension.status, "rejected");
  assert.equal(decided.consultancy.status, "active");
  assert.equal(decided.consultancy.currentCompletionDate, "2026-06-01");

  // faculty cannot decide their own extension
  const requestRes2 = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/extensions`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ proposedCompletionDate: "2026-12-15", reason: "again" }),
  });
  const extension2 = (await requestRes2.json()).data;
  const facultyDecide = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/extensions/${extension2.id}/decide`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "approve" }),
  });
  assert.equal(facultyDecide.status, 403);
});

test("on-hold period does not trigger a false completion-overdue or milestone-overdue flag", async () => {
  const consultancy = await createActiveConsultancy();

  // an overdue milestone while active is flagged
  const milestoneRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/milestones`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ title: "Old milestone", plannedDate: "2020-01-01" }),
  });
  const milestone = (await milestoneRes.json()).data;

  const derivedBefore = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/derived`, { headers: { cookie: facultyCookie } });
  const beforeBody = (await derivedBefore.json()).data;
  assert.equal(beforeBody.overdueMilestones.length, 1);
  assert.equal(beforeBody.overdueMilestones[0].id, milestone.id);

  const holdRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/hold`, {
    method: "POST",
    headers: { cookie: hodCookie, "content-type": "application/json" },
    body: JSON.stringify({ reason: "PI on leave", startDate: "2026-02-01" }),
  });
  assert.equal(holdRes.status, 201);
  const held = (await holdRes.json()).data;
  assert.equal(held.consultancy.status, "on_hold");

  const derivedDuring = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/derived`, { headers: { cookie: facultyCookie } });
  const duringBody = (await derivedDuring.json()).data;
  assert.equal(duringBody.overdueMilestones.length, 0);
  assert.equal(duringBody.isCompletionOverdue, false);

  // progress can't be logged while on hold
  const progressWhileOnHold = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/progress-updates`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      reportDate: "2026-02-15",
      reportingPeriodStart: "2026-02-01",
      reportingPeriodEnd: "2026-02-14",
      status: "on_hold",
      overallProgressPercent: 40,
      workCompleted: "Work done.",
      workInProgress: "Work ongoing.",
    }),
  });
  assert.equal(progressWhileOnHold.status, 409);

  const cannotHoldAgain = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/hold`, {
    method: "POST",
    headers: { cookie: hodCookie, "content-type": "application/json" },
    body: JSON.stringify({ reason: "again", startDate: "2026-02-05" }),
  });
  assert.equal(cannotHoldAgain.status, 409);

  const resumeRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/resume`, {
    method: "POST",
    headers: { cookie: hodCookie, "content-type": "application/json" },
  });
  assert.equal(resumeRes.status, 200);
  const resumed = (await resumeRes.json()).data;
  assert.equal(resumed.consultancy.status, "active");
  assert.ok(resumed.hold.actualResumeDate);

  const derivedAfter = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/derived`, { headers: { cookie: facultyCookie } });
  const afterBody = (await derivedAfter.json()).data;
  assert.equal(afterBody.overdueMilestones.length, 1);
});

test("cancelled and terminated consultancies remain queryable but are excluded from the active list, and are not deleted", async () => {
  const toCancel = await createActiveConsultancy();
  const toTerminate = await createActiveConsultancy();

  const cancelRes = await fetch(`${BASE_URL}/api/consultancies/${toCancel.id}/cancel`, {
    method: "POST",
    headers: { cookie: hodCookie, "content-type": "application/json" },
    body: JSON.stringify({ reason: "Client withdrew", date: "2026-02-01", financialStatus: "No payments received" }),
  });
  assert.equal(cancelRes.status, 201);
  const cancelled = (await cancelRes.json()).data;
  assert.equal(cancelled.consultancy.status, "cancelled");

  const terminateRes = await fetch(`${BASE_URL}/api/consultancies/${toTerminate.id}/terminate`, {
    method: "POST",
    headers: { cookie: iiicAdminCookie, "content-type": "application/json" },
    body: JSON.stringify({
      reason: "Institutional decision",
      actualTerminationDate: "2026-02-15",
      financialStatus: "Partially paid",
      outstandingDeliverables: "Final report",
    }),
  });
  assert.equal(terminateRes.status, 201);
  const terminated = (await terminateRes.json()).data;
  assert.equal(terminated.consultancy.status, "terminated");

  // faculty cannot self-cancel or self-terminate
  const facultyCancel = await fetch(`${BASE_URL}/api/consultancies/${toCancel.id}/cancel`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ reason: "x", date: "2026-02-01", financialStatus: "x" }),
  });
  assert.equal(facultyCancel.status, 403);

  // still individually queryable
  const getCancelled = await fetch(`${BASE_URL}/api/consultancies/${toCancel.id}`, { headers: { cookie: facultyCookie } });
  assert.equal(getCancelled.status, 200);
  const getTerminated = await fetch(`${BASE_URL}/api/consultancies/${toTerminate.id}`, { headers: { cookie: facultyCookie } });
  assert.equal(getTerminated.status, 200);

  // excluded from the active list
  const activeList = await fetch(`${BASE_URL}/api/consultancies?status=active`, { headers: { cookie: facultyCookie } });
  const activeIds = (await activeList.json()).data.map((c: { id: string }) => c.id);
  assert.ok(!activeIds.includes(toCancel.id));
  assert.ok(!activeIds.includes(toTerminate.id));

  // present in their own status filters
  const cancelledList = await fetch(`${BASE_URL}/api/consultancies?status=cancelled`, { headers: { cookie: facultyCookie } });
  const cancelledIds = (await cancelledList.json()).data.map((c: { id: string }) => c.id);
  assert.ok(cancelledIds.includes(toCancel.id));

  // already-terminal: can't cancel again
  const cancelAgain = await fetch(`${BASE_URL}/api/consultancies/${toCancel.id}/cancel`, {
    method: "POST",
    headers: { cookie: hodCookie, "content-type": "application/json" },
    body: JSON.stringify({ reason: "x", date: "2026-02-01", financialStatus: "x" }),
  });
  assert.equal(cancelAgain.status, 409);
});
