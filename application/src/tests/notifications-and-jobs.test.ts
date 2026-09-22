import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { createTestSessionCookie } from "./helpers/session";
import { upsertTestUser, upsertTestDepartment, upsertTestApprovalStageConfig, BASE_URL } from "./helpers/fixtures";
import { closeDb, db } from "@/db";
import { documents, notifications } from "@/db/schema";

let facultyCookie: string;
let facultyId: string;
let hodCookie: string;
let hodId: string;
let iiicAdminCookie: string;
let iiicAdminId: string;
let departmentId: string;

const JOBS_SECRET = "dev-only-jobs-secret";

after(async () => {
  await closeDb();
});

before(async () => {
  const department = await upsertTestDepartment({ code: "PHASE11DEPT", name: "Phase 11 Test Dept" });
  departmentId = department.id;

  const faculty = await upsertTestUser({
    keycloakSub: "test-faculty-phase11",
    name: "Phase 11 Test Faculty",
    email: "test.faculty.phase11@caias.in",
    roles: ["faculty"],
    departmentId,
  });
  facultyId = faculty.id;
  facultyCookie = await createTestSessionCookie({ userId: faculty.id, roles: ["faculty"] });

  const hod = await upsertTestUser({
    keycloakSub: "test-hod-phase11",
    name: "Phase 11 Test HOD",
    email: "test.hod.phase11@caias.in",
    roles: ["hod"],
    departmentId,
  });
  hodId = hod.id;
  hodCookie = await createTestSessionCookie({ userId: hod.id, roles: ["hod"] });

  const iiicAdmin = await upsertTestUser({
    keycloakSub: "test-iiicadmin-phase11",
    name: "Phase 11 Test IIIC Admin",
    email: "test.iiicadmin.phase11@caias.in",
    roles: ["iiic_admin"],
  });
  iiicAdminId = iiicAdmin.id;
  iiicAdminCookie = await createTestSessionCookie({ userId: iiicAdmin.id, roles: ["iiic_admin"] });

  await upsertTestApprovalStageConfig({
    id: "00000000-0000-0000-0000-0000000000f1",
    departmentId,
    stage: "hod_verification_pending",
    sequence: 1,
    approverRole: "hod",
  });
});

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const copy = new Date(base);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function validSubmitPayload(completionDate: string, overrides: Record<string, unknown> = {}) {
  return {
    consultancy: {
      departmentId,
      academicYearCode: "2025-26",
      consultancyTypeCode: "individual_faculty",
      teamTypeCode: "single_faculty",
      title: "Phase 11 Test Consultancy",
      consultancyAreaCode: "artificial_intelligence",
      startDate: "2026-01-01",
      expectedCompletionDate: completionDate,
    },
    client: { organizationName: "Test Client Org", organizationTypeCode: "private_company" },
    agreement: { agreementTypeCode: "work_order", agreementValue: "50000", paymentTermsCode: "milestone_based" },
    team: { members: [{ name: "Phase 11 Test Faculty", role: "Principal Investigator" }] },
    financial: { totalValue: "50000" },
    scope: { scopeOfWork: "Build a test integration.", deliverables: [{ description: "Final report" }] },
    resources: {},
    ...overrides,
  };
}

async function createDraft(title = "Phase 11 Test Consultancy") {
  const res = await fetch(`${BASE_URL}/api/consultancies`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      departmentId,
      academicYearCode: "2025-26",
      consultancyTypeCode: "individual_faculty",
      teamTypeCode: "single_faculty",
      title,
      consultancyAreaCode: "artificial_intelligence",
    }),
  });
  return (await res.json()).data;
}

async function submit(draftId: string, completionDate: string) {
  await db.insert(documents).values({
    consultancyId: draftId,
    documentCategory: "Signed Agreement",
    originalFileName: "agreement.pdf",
    objectKey: `test/${draftId}/agreement.pdf`,
    status: "available",
    uploadedBy: facultyId,
  });
  const res = await fetch(`${BASE_URL}/api/consultancies/${draftId}/submit`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify(validSubmitPayload(completionDate)),
  });
  assert.equal(res.status, 200);
  return (await res.json()).data;
}

async function createActiveConsultancy(completionDate: string) {
  const draft = await createDraft();
  const submitted = await submit(draft.id, completionDate);
  await fetch(`${BASE_URL}/api/consultancies/${submitted.id}/verify`, {
    method: "POST",
    headers: { cookie: hodCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "verify" }),
  });
  const activateRes = await fetch(`${BASE_URL}/api/consultancies/${submitted.id}/activate`, {
    method: "POST",
    headers: { cookie: iiicAdminCookie, "content-type": "application/json" },
  });
  const activated = (await activateRes.json()).data;
  assert.equal(activated.status, "active");
  return activated;
}

async function runDailyChecks() {
  const res = await fetch(`${BASE_URL}/api/jobs/daily-checks`, {
    method: "POST",
    headers: { "x-jobs-secret": JOBS_SECRET },
  });
  assert.equal(res.status, 200);
  return (await res.json()).data;
}

test("the daily-check endpoint requires the shared secret, not a user session", async () => {
  const noHeader = await fetch(`${BASE_URL}/api/jobs/daily-checks`, { method: "POST" });
  assert.equal(noHeader.status, 401);

  const wrongSecret = await fetch(`${BASE_URL}/api/jobs/daily-checks`, {
    method: "POST",
    headers: { "x-jobs-secret": "not-the-right-secret" },
  });
  assert.equal(wrongSecret.status, 401);

  const sessionOnly = await fetch(`${BASE_URL}/api/jobs/daily-checks`, {
    method: "POST",
    headers: { cookie: iiicAdminCookie },
  });
  assert.equal(sessionOnly.status, 401);

  const withSecret = await fetch(`${BASE_URL}/api/jobs/daily-checks`, {
    method: "POST",
    headers: { "x-jobs-secret": JOBS_SECRET },
  });
  assert.equal(withSecret.status, 200);
});

test("the daily check correctly flags a just-past-completion consultancy, a 30-days-out one, and NOT one with a valid extension on record", async () => {
  const today = new Date();

  const pastDue = await createActiveConsultancy(formatDate(addDays(today, -5)));
  const thirtyOut = await createActiveConsultancy(formatDate(addDays(today, 30)));
  const extended = await createActiveConsultancy(formatDate(addDays(today, -5)));

  // give `extended` a valid, approved extension that moves it safely into the future
  const extRequestRes = await fetch(`${BASE_URL}/api/consultancies/${extended.id}/extensions`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ proposedCompletionDate: formatDate(addDays(today, 60)), reason: "Scope grew" }),
  });
  const extension = (await extRequestRes.json()).data;
  const decideRes = await fetch(`${BASE_URL}/api/consultancies/${extended.id}/extensions/${extension.id}/decide`, {
    method: "POST",
    headers: { cookie: hodCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "approve" }),
  });
  assert.equal(decideRes.status, 200);

  const summary = await runDailyChecks();

  const ids = (arr: { consultancyId: string }[]) => arr.map((f) => f.consultancyId);
  assert.ok(ids(summary.autoTransitionedToDelayed).includes(pastDue.id));
  assert.ok(ids(summary.thirtyDaysOut).includes(thirtyOut.id));
  assert.ok(!ids(summary.autoTransitionedToDelayed).includes(extended.id));
  assert.ok(!ids(summary.autoTransitionedToDelayed).includes(thirtyOut.id));

  const pastDueRow = await fetch(`${BASE_URL}/api/consultancies/${pastDue.id}`, { headers: { cookie: facultyCookie } });
  assert.equal((await pastDueRow.json()).data.consultancy.status, "delayed");

  const extendedRow = await fetch(`${BASE_URL}/api/consultancies/${extended.id}`, { headers: { cookie: facultyCookie } });
  assert.equal((await extendedRow.json()).data.consultancy.status, "active");

  // the newly-delayed one (no payment, no closure yet) also gets the missing-payment/closure flags
  assert.ok(ids(summary.missingPayment).includes(pastDue.id));
  assert.ok(ids(summary.missingClosure).includes(pastDue.id));

  const facultyNotifications = await db.query.notifications.findMany({
    where: and(eq(notifications.consultancyId, pastDue.id), eq(notifications.type, "auto_delayed")),
  });
  assert.ok(facultyNotifications.some((n) => n.userId === facultyId));
  const hodNotifications = await db.query.notifications.findMany({
    where: and(eq(notifications.consultancyId, pastDue.id), eq(notifications.type, "auto_delayed"), eq(notifications.role, "hod")),
  });
  assert.ok(hodNotifications.some((n) => n.userId === hodId));
});

test("each workflow action produces the correct notification row(s) for the correct role", async () => {
  const draft = await createDraft("Notification Chain Test");
  const submitted = await submit(draft.id, "2026-12-01");

  const submitNotifications = await db.query.notifications.findMany({
    where: and(eq(notifications.consultancyId, submitted.id), eq(notifications.type, "verification_pending")),
  });
  assert.ok(submitNotifications.some((n) => n.userId === hodId && n.role === "hod"));

  const verifyRes = await fetch(`${BASE_URL}/api/consultancies/${submitted.id}/verify`, {
    method: "POST",
    headers: { cookie: hodCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "verify" }),
  });
  assert.equal(verifyRes.status, 200);

  const registeredNotifications = await db.query.notifications.findMany({
    where: and(eq(notifications.consultancyId, submitted.id), eq(notifications.type, "registered")),
  });
  assert.ok(registeredNotifications.some((n) => n.userId === facultyId));

  const activateRes = await fetch(`${BASE_URL}/api/consultancies/${submitted.id}/activate`, {
    method: "POST",
    headers: { cookie: iiicAdminCookie, "content-type": "application/json" },
  });
  assert.equal(activateRes.status, 200);

  const activatedNotifications = await db.query.notifications.findMany({
    where: and(eq(notifications.consultancyId, submitted.id), eq(notifications.type, "activated")),
  });
  assert.ok(activatedNotifications.some((n) => n.userId === facultyId));

  const [finalReport] = await db
    .insert(documents)
    .values({
      consultancyId: submitted.id,
      documentCategory: "Deliverable",
      originalFileName: "final-report.pdf",
      objectKey: `test/${submitted.id}/final-report.pdf`,
      status: "available",
      uploadedBy: facultyId,
    })
    .returning();

  const closureRes = await fetch(`${BASE_URL}/api/consultancies/${submitted.id}/closures`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      actualCompletionDate: "2026-11-01",
      deliverableCompletionStatus: "yes",
      finalOutcomes: "Done.",
      finalReportDocumentId: finalReport.id,
    }),
  });
  assert.equal(closureRes.status, 201);
  const closure = (await closureRes.json()).data;

  const closurePendingNotifications = await db.query.notifications.findMany({
    where: and(eq(notifications.consultancyId, submitted.id), eq(notifications.type, "closure_review_pending")),
  });
  assert.ok(closurePendingNotifications.some((n) => n.userId === iiicAdminId && n.role === "iiic_admin"));

  const financeUser = await upsertTestUser({
    keycloakSub: "test-finance-phase11-b",
    name: "Phase 11 Finance",
    email: "test.finance.phase11.b@caias.in",
    roles: ["finance"],
  });
  const financeCookie = await createTestSessionCookie({ userId: financeUser.id, roles: ["finance"] });
  await fetch(`${BASE_URL}/api/consultancies/${submitted.id}/payment-transactions`, {
    method: "POST",
    headers: { cookie: financeCookie, "content-type": "application/json" },
    body: JSON.stringify({
      amount: "50000",
      transactionDate: "2026-10-01",
      institutionalAccountRef: "ACC-1",
      transactionRef: "TXN-NOTIF",
    }),
  });

  const verifyClosureRes = await fetch(`${BASE_URL}/api/consultancies/${submitted.id}/closures/${closure.id}/verify`, {
    method: "POST",
    headers: { cookie: iiicAdminCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "verified" }),
  });
  assert.equal(verifyClosureRes.status, 200);

  const closedNotifications = await db.query.notifications.findMany({
    where: and(eq(notifications.consultancyId, submitted.id), eq(notifications.type, "closure_verified")),
  });
  assert.ok(closedNotifications.some((n) => n.userId === facultyId));
});

test("reject and return-for-clarification each produce a notification to the record's creator", async () => {
  const rejectDraft = await createDraft("Reject Notification Test");
  const rejectSubmitted = await submit(rejectDraft.id, "2026-12-01");
  await fetch(`${BASE_URL}/api/consultancies/${rejectSubmitted.id}/verify`, {
    method: "POST",
    headers: { cookie: hodCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "reject", comments: "Not viable" }),
  });
  const rejectNotifications = await db.query.notifications.findMany({
    where: and(eq(notifications.consultancyId, rejectSubmitted.id), eq(notifications.type, "rejected")),
  });
  assert.ok(rejectNotifications.some((n) => n.userId === facultyId));

  const returnDraft = await createDraft("Return Notification Test");
  const returnSubmitted = await submit(returnDraft.id, "2026-12-01");
  await fetch(`${BASE_URL}/api/consultancies/${returnSubmitted.id}/verify`, {
    method: "POST",
    headers: { cookie: hodCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "return", comments: "Fix the title", flaggedFields: ["title"] }),
  });
  const returnNotifications = await db.query.notifications.findMany({
    where: and(eq(notifications.consultancyId, returnSubmitted.id), eq(notifications.type, "clarification_required")),
  });
  assert.ok(returnNotifications.some((n) => n.userId === facultyId));
});
