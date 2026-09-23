import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSessionCookie } from "./helpers/session";
import { upsertTestUser, upsertTestDepartment, upsertTestApprovalStageConfig, BASE_URL } from "./helpers/fixtures";
import { closeDb, db } from "@/db";
import { documents } from "@/db/schema";

let facultyCookie: string;
let financeCookie: string;
let hodCookie: string;
let iiicAdminCookie: string;
let departmentId: string;

after(async () => {
  await closeDb();
});

before(async () => {
  const department = await upsertTestDepartment({ code: "PHASE9DEPT", name: "Phase 9 Test Dept" });
  departmentId = department.id;

  const faculty = await upsertTestUser({
    keycloakSub: "test-faculty-phase9",
    name: "Phase 9 Test Faculty",
    email: "test.faculty.phase9@caias.in",
    roles: ["faculty"],
  });
  facultyCookie = await createTestSessionCookie({ userId: faculty.id, roles: ["faculty"] });

  const finance = await upsertTestUser({
    keycloakSub: "test-finance-phase9",
    name: "Phase 9 Test Finance",
    email: "test.finance.phase9@caias.in",
    roles: ["finance"],
  });
  financeCookie = await createTestSessionCookie({ userId: finance.id, roles: ["finance"] });

  const hod = await upsertTestUser({
    keycloakSub: "test-hod-phase9",
    name: "Phase 9 Test HOD",
    email: "test.hod.phase9@caias.in",
    roles: ["hod"],
  });
  hodCookie = await createTestSessionCookie({ userId: hod.id, roles: ["hod"] });

  const iiicAdmin = await upsertTestUser({
    keycloakSub: "test-iiicadmin-phase9",
    name: "Phase 9 Test IIIC Admin",
    email: "test.iiicadmin.phase9@caias.in",
    roles: ["iiic_admin"],
  });
  iiicAdminCookie = await createTestSessionCookie({ userId: iiicAdmin.id, roles: ["iiic_admin"] });

  await upsertTestApprovalStageConfig({
    id: "00000000-0000-0000-0000-0000000000d1",
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
      title: "Financials Test Consultancy",
      consultancyAreaCode: "artificial_intelligence",
      startDate: "2026-01-01",
      expectedCompletionDate: "2026-06-01",
    },
    client: { organizationName: "Test Client Org", organizationTypeCode: "private_company" },
    agreement: { agreementTypeCode: "work_order", agreementValue: "100000", paymentTermsCode: "milestone_based" },
    team: { members: [{ name: "Phase 9 Test Faculty", role: "Principal Investigator" }] },
    financial: { totalValue: "100000" },
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
      title: "Financials Test Consultancy",
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

async function recordTransaction(id: string, cookie: string, body: Record<string, unknown>) {
  return fetch(`${BASE_URL}/api/consultancies/${id}/payment-transactions`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("a faculty-scoped call to any payment-write action is rejected", async () => {
  const consultancy = await createActiveConsultancy();

  const txRes = await recordTransaction(consultancy.id, facultyCookie, {
    amount: "1000",
    transactionDate: "2026-02-01",
    institutionalAccountRef: "ACC-1",
    transactionRef: "TXN-1",
  });
  assert.equal(txRes.status, 403);

  const scheduleRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/payment-schedules`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ stageLabel: "Milestone 1", plannedAmount: "50000" }),
  });
  assert.equal(scheduleRes.status, 403);

  const adjustmentRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/payment-adjustments`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ amount: "1000", reason: "test" }),
  });
  assert.equal(adjustmentRes.status, 403);

  // hod/iiic_admin also have no payment-write access — finance is exclusive
  const hodTx = await recordTransaction(consultancy.id, hodCookie, {
    amount: "1000",
    transactionDate: "2026-02-01",
    institutionalAccountRef: "ACC-1",
    transactionRef: "TXN-2",
  });
  assert.equal(hodTx.status, 403);
});

test("payment schedule rows can be edited by finance, but not by faculty or hod", async () => {
  const consultancy = await createActiveConsultancy();

  const createRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/payment-schedules`, {
    method: "POST",
    headers: { cookie: financeCookie, "content-type": "application/json" },
    body: JSON.stringify({ stageLabel: "Advance", plannedAmount: "30000", plannedDate: "2026-02-01" }),
  });
  assert.equal(createRes.status, 201);
  const schedule = (await createRes.json()).data;

  const facultyEditRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/payment-schedules/${schedule.id}`, {
    method: "PATCH",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ plannedAmount: "35000" }),
  });
  assert.equal(facultyEditRes.status, 403);

  const hodEditRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/payment-schedules/${schedule.id}`, {
    method: "PATCH",
    headers: { cookie: hodCookie, "content-type": "application/json" },
    body: JSON.stringify({ plannedAmount: "35000" }),
  });
  assert.equal(hodEditRes.status, 403);

  const financeEditRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/payment-schedules/${schedule.id}`, {
    method: "PATCH",
    headers: { cookie: financeCookie, "content-type": "application/json" },
    body: JSON.stringify({ plannedAmount: "35000", stageLabel: "Advance (revised)" }),
  });
  assert.equal(financeEditRes.status, 200);
  const updated = (await financeEditRes.json()).data;
  assert.equal(updated.plannedAmount, "35000.00");
  assert.equal(updated.stageLabel, "Advance (revised)");
});

test("overpayment beyond agreement value is rejected with a clear error, and succeeds once an adjustment covers it", async () => {
  const consultancy = await createActiveConsultancy(); // agreement value 100000

  const first = await recordTransaction(consultancy.id, financeCookie, {
    amount: "60000",
    transactionDate: "2026-02-01",
    institutionalAccountRef: "ACC-1",
    transactionRef: "TXN-A",
  });
  assert.equal(first.status, 201);

  const overpay = await recordTransaction(consultancy.id, financeCookie, {
    amount: "50000",
    transactionDate: "2026-03-01",
    institutionalAccountRef: "ACC-1",
    transactionRef: "TXN-B",
  });
  assert.equal(overpay.status, 409);
  const overpayBody = await overpay.json();
  assert.match(String(overpayBody.error), /exceed the agreement value/i);

  const adjustmentRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/payment-adjustments`, {
    method: "POST",
    headers: { cookie: financeCookie, "content-type": "application/json" },
    body: JSON.stringify({ amount: "20000", reason: "Approved scope addition" }),
  });
  assert.equal(adjustmentRes.status, 201);

  // ceiling is now 100000 + 20000 = 120000; existing 60000 + 50000 = 110000 fits
  const nowFits = await recordTransaction(consultancy.id, financeCookie, {
    amount: "50000",
    transactionDate: "2026-03-01",
    institutionalAccountRef: "ACC-1",
    transactionRef: "TXN-C",
  });
  assert.equal(nowFits.status, 201);

  const stillOver = await recordTransaction(consultancy.id, financeCookie, {
    amount: "50000",
    transactionDate: "2026-04-01",
    institutionalAccountRef: "ACC-1",
    transactionRef: "TXN-D",
  });
  assert.equal(stillOver.status, 409);
});

test("payment status is derivable and correct from the transaction history", async () => {
  const consultancy = await createActiveConsultancy(); // totalValue 100000

  const notInvoicedRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/financial-summary`, {
    headers: { cookie: facultyCookie },
  });
  const notInvoiced = (await notInvoicedRes.json()).data;
  assert.equal(notInvoiced.paymentStatus, "not_invoiced");
  assert.equal(notInvoiced.totalReceived, 0);
  assert.equal(notInvoiced.amountPending, 100000);

  await recordTransaction(consultancy.id, financeCookie, {
    amount: "40000",
    transactionDate: "2026-02-01",
    institutionalAccountRef: "ACC-1",
    transactionRef: "TXN-P1",
  });

  const partialRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/financial-summary`, {
    headers: { cookie: facultyCookie },
  });
  const partial = (await partialRes.json()).data;
  assert.equal(partial.paymentStatus, "partially_received");
  assert.equal(partial.totalReceived, 40000);
  assert.equal(partial.amountPending, 60000);

  await recordTransaction(consultancy.id, financeCookie, {
    amount: "60000",
    transactionDate: "2026-03-01",
    institutionalAccountRef: "ACC-1",
    transactionRef: "TXN-P2",
  });

  const fullRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/financial-summary`, {
    headers: { cookie: facultyCookie },
  });
  const full = (await fullRes.json()).data;
  assert.equal(full.paymentStatus, "fully_received");
  assert.equal(full.amountPending, 0);

  // faculty can read but has no write access (double-checked here in the read-focused test too)
  const listRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/payment-transactions`, {
    headers: { cookie: facultyCookie },
  });
  assert.equal(listRes.status, 200);
  const list = (await listRes.json()).data;
  assert.equal(list.length, 2);
});

test("payment status is overdue when a scheduled stage's planned date has passed without full receipt", async () => {
  const consultancy = await createActiveConsultancy();

  await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/payment-schedules`, {
    method: "POST",
    headers: { cookie: financeCookie, "content-type": "application/json" },
    body: JSON.stringify({ stageLabel: "Advance", plannedAmount: "30000", plannedDate: "2020-01-01" }),
  });

  const overdueRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/financial-summary`, {
    headers: { cookie: facultyCookie },
  });
  const overdue = (await overdueRes.json()).data;
  assert.equal(overdue.paymentStatus, "overdue");

  await recordTransaction(consultancy.id, financeCookie, {
    amount: "30000",
    transactionDate: "2026-02-01",
    institutionalAccountRef: "ACC-1",
    transactionRef: "TXN-CATCHUP",
  });

  const caughtUpRes = await fetch(`${BASE_URL}/api/consultancies/${consultancy.id}/financial-summary`, {
    headers: { cookie: facultyCookie },
  });
  const caughtUp = (await caughtUpRes.json()).data;
  assert.notEqual(caughtUp.paymentStatus, "overdue");
});
