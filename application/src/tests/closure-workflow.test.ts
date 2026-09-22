import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSessionCookie } from "./helpers/session";
import { upsertTestUser, upsertTestDepartment, upsertTestApprovalStageConfig, BASE_URL } from "./helpers/fixtures";
import { closeDb, db } from "@/db";
import { documents } from "@/db/schema";

let facultyCookie: string;
let facultyId: string;
let hodCookie: string;
let iiicAdminCookie: string;
let financeCookie: string;
let departmentId: string;

after(async () => {
  await closeDb();
});

before(async () => {
  const department = await upsertTestDepartment({ code: "PHASE10DEPT", name: "Phase 10 Test Dept" });
  departmentId = department.id;

  const faculty = await upsertTestUser({
    keycloakSub: "test-faculty-phase10",
    name: "Phase 10 Test Faculty",
    email: "test.faculty.phase10@caias.in",
    roles: ["faculty"],
  });
  facultyId = faculty.id;
  facultyCookie = await createTestSessionCookie({ userId: faculty.id, roles: ["faculty"] });

  const hod = await upsertTestUser({
    keycloakSub: "test-hod-phase10",
    name: "Phase 10 Test HOD",
    email: "test.hod.phase10@caias.in",
    roles: ["hod"],
  });
  hodCookie = await createTestSessionCookie({ userId: hod.id, roles: ["hod"] });

  const iiicAdmin = await upsertTestUser({
    keycloakSub: "test-iiicadmin-phase10",
    name: "Phase 10 Test IIIC Admin",
    email: "test.iiicadmin.phase10@caias.in",
    roles: ["iiic_admin"],
  });
  iiicAdminCookie = await createTestSessionCookie({ userId: iiicAdmin.id, roles: ["iiic_admin"] });

  const finance = await upsertTestUser({
    keycloakSub: "test-finance-phase10",
    name: "Phase 10 Test Finance",
    email: "test.finance.phase10@caias.in",
    roles: ["finance"],
  });
  financeCookie = await createTestSessionCookie({ userId: finance.id, roles: ["finance"] });

  await upsertTestApprovalStageConfig({
    id: "00000000-0000-0000-0000-0000000000e1",
    departmentId,
    stage: "hod_verification_pending",
    sequence: 1,
    approverRole: "hod",
  });
});

function validSubmitPayload(overrides: Record<string, unknown> = {}) {
  return {
    consultancy: {
      departmentId,
      academicYearCode: "2025-26",
      consultancyTypeCode: "individual_faculty",
      teamTypeCode: "single_faculty",
      title: "Closure Test Consultancy",
      consultancyAreaCode: "artificial_intelligence",
      startDate: "2026-01-01",
      expectedCompletionDate: "2026-06-01",
    },
    client: { organizationName: "Test Client Org", organizationTypeCode: "private_company" },
    agreement: { agreementTypeCode: "work_order", agreementValue: "50000", paymentTermsCode: "milestone_based" },
    team: { members: [{ name: "Phase 10 Test Faculty", role: "Principal Investigator" }] },
    financial: { totalValue: "50000" },
    scope: { scopeOfWork: "Build a test integration.", deliverables: [{ description: "Final report" }] },
    resources: {},
    ...overrides,
  };
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
      title: "Closure Test Consultancy",
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

async function uploadFinalReport(consultancyId: string) {
  const [doc] = await db
    .insert(documents)
    .values({
      consultancyId,
      documentCategory: "Deliverable",
      originalFileName: "final-report.pdf",
      objectKey: `test/${consultancyId}/final-report.pdf`,
      status: "available",
      uploadedBy: facultyId,
    })
    .returning();
  return doc;
}

async function requestClosure(consultancyId: string, overrides: Record<string, unknown> = {}) {
  const finalReport = await uploadFinalReport(consultancyId);
  return fetch(`${BASE_URL}/api/consultancies/${consultancyId}/closures`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      actualCompletionDate: "2026-05-01",
      deliverableCompletionStatus: "yes",
      finalOutcomes: "All deliverables completed successfully.",
      finalReportDocumentId: finalReport.id,
      ...overrides,
    }),
  });
}

test("closure request is rejected if the final report isn't uploaded, with a specific missing-item message", async () => {
  const consultancy = await createActiveConsultancy();

  const res = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/closures`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      actualCompletionDate: "2026-05-01",
      deliverableCompletionStatus: "yes",
      finalOutcomes: "Done.",
      finalReportDocumentId: "00000000-0000-0000-0000-000000000000",
    }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(String(body.error), /final report/i);
});

test("closure with unpaid balance succeeds only when an authorised_exception exists", async () => {
  const consultancy = await createActiveConsultancy(); // totalValue 50000, nothing paid

  const requestRes = await requestClosure(consultancy.id);
  assert.equal(requestRes.status, 201);
  const closure = (await requestRes.json()).data;

  const statusAfterRequest = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}`, { headers: { cookie: facultyCookie } });
  assert.equal((await statusAfterRequest.json()).data.consultancy.status, "closure_requested");

  const blockedRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/closures/${closure.id}/verify`, {
    method: "POST",
    headers: { cookie: iiicAdminCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "verified" }),
  });
  assert.equal(blockedRes.status, 409);
  const blockedBody = await blockedRes.json();
  assert.ok(blockedBody.error.reasons.some((r: string) => /outstanding balance/i.test(r)));

  const exceptionRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/closures/${closure.id}/exception`, {
    method: "POST",
    headers: { cookie: financeCookie, "content-type": "application/json" },
    body: JSON.stringify({
      reason: "Client dispute under negotiation",
      amountOutstanding: "50000",
      expectedRecoveryAction: "Legal follow-up",
      date: "2026-05-02",
    }),
  });
  assert.equal(exceptionRes.status, 201);

  const okRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/closures/${closure.id}/verify`, {
    method: "POST",
    headers: { cookie: iiicAdminCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "verified" }),
  });
  assert.equal(okRes.status, 200);
  const ok = (await okRes.json()).data;
  assert.equal(ok.closure.status, "verified");
  assert.equal(ok.consultancy.status, "completed_closed");
  assert.equal(ok.consultancy.actualCompletionDate, "2026-05-01");
});

test("clarification_required returns the consultancy to active, and it can be closed via a fresh request once fully paid", async () => {
  const consultancy = await createActiveConsultancy();

  const requestRes = await requestClosure(consultancy.id);
  const closure = (await requestRes.json()).data;

  const clarifyRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/closures/${closure.id}/verify`, {
    method: "POST",
    headers: { cookie: iiicAdminCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "clarification_required", comments: "Please confirm outstanding payment plan" }),
  });
  assert.equal(clarifyRes.status, 200);
  const clarified = (await clarifyRes.json()).data;
  assert.equal(clarified.closure.status, "clarification_required");
  assert.equal(clarified.consultancy.status, "active");

  // pay it off, then request closure again
  await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/payment-transactions`, {
    method: "POST",
    headers: { cookie: financeCookie, "content-type": "application/json" },
    body: JSON.stringify({
      amount: "50000",
      transactionDate: "2026-05-01",
      institutionalAccountRef: "ACC-1",
      transactionRef: "TXN-FULL",
    }),
  });

  const secondRequestRes = await requestClosure(consultancy.id);
  assert.equal(secondRequestRes.status, 201);
  const secondClosure = (await secondRequestRes.json()).data;

  const finalRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/closures/${secondClosure.id}/verify`, {
    method: "POST",
    headers: { cookie: iiicAdminCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "verified" }),
  });
  assert.equal(finalRes.status, 200);
  const final = (await finalRes.json()).data;
  assert.equal(final.consultancy.status, "completed_closed");
});

test("the generated Closure Record correctly aggregates data from all three lifecycle stages", async () => {
  const consultancy = await createActiveConsultancy();

  await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/progress-updates`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      reportDate: "2026-02-01",
      reportingPeriodStart: "2026-01-01",
      reportingPeriodEnd: "2026-01-31",
      status: "on_track",
      overallProgressPercent: 100,
    }),
  });
  await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/milestones`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ title: "Kickoff", plannedDate: "2026-01-10" }),
  });

  await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/payment-transactions`, {
    method: "POST",
    headers: { cookie: financeCookie, "content-type": "application/json" },
    body: JSON.stringify({
      amount: "50000",
      transactionDate: "2026-04-01",
      institutionalAccountRef: "ACC-1",
      transactionRef: "TXN-FULL-2",
    }),
  });

  const requestRes = await requestClosure(consultancy.id);
  const closure = (await requestRes.json()).data;
  await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/closures/${closure.id}/verify`, {
    method: "POST",
    headers: { cookie: iiicAdminCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "verified" }),
  });

  const recordRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/closure-record`, {
    headers: { cookie: facultyCookie },
  });
  assert.equal(recordRes.status, 200);
  const record = (await recordRes.json()).data;

  assert.equal(record.registration.consultancy.id, consultancy.id);
  assert.equal(record.registration.client.organizationName, "Test Client Org");
  assert.equal(record.monitoring.progressUpdates.length, 1);
  assert.equal(record.monitoring.milestones.length, 1);
  assert.equal(record.closure.current.id, closure.id);
  assert.equal(record.closure.current.status, "verified");
  assert.equal(record.financial.paymentStatus, "fully_received");

  // and it shows up in the auto-populated Consultancy Register
  const registerRes = await fetch(`${BASE_URL}/api/consultancies/register`, { headers: { cookie: facultyCookie } });
  assert.equal(registerRes.status, 200);
  const register = (await registerRes.json()).data;
  assert.ok(register.some((r: { consultancyId: string }) => r.consultancyId === consultancy.id));
});
