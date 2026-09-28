import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { createTestSessionCookie } from "./helpers/session";
import {
  upsertTestUser,
  upsertTestDepartment,
  upsertTestApprovalStageConfig,
  BASE_URL,
  withRegistrationDefaults,
  withClosureDefaults,
  financeVerifyClosure,
} from "./helpers/fixtures";
import { closeDb, db } from "@/db";
import { auditEvents, consultancies, documents, reopenings } from "@/db/schema";
import { selectApprovalChain } from "@/lib/consultancy/approval-chain";

/**
 * Portal spec v2 lifecycle additions: Finance closure verification, client
 * acceptance / feedback, explicit reopening, archiving, approval
 * configuration, record-level access and the register's spec fields.
 */

let facultyCookie: string;
let facultyId: string;
let otherFacultyCookie: string;
let hodCookie: string;
let adminCookie: string;
let financeCookie: string;
let departmentId: string;

after(async () => {
  await closeDb();
});

before(async () => {
  const department = await upsertTestDepartment({ code: "SPECV2DEPT", name: "Portal Spec Test Dept" });
  departmentId = department.id;
  const otherDepartment = await upsertTestDepartment({ code: "SPECV2OTHER", name: "Portal Spec Other Dept" });

  const faculty = await upsertTestUser({
    keycloakSub: "test-faculty-specv2",
    name: "Spec Test Faculty",
    email: "test.faculty.specv2@caias.in",
    roles: ["faculty"],
    departmentId,
  });
  facultyId = faculty.id;
  facultyCookie = await createTestSessionCookie({ userId: faculty.id, roles: ["faculty"], departmentId });

  const other = await upsertTestUser({
    keycloakSub: "test-other-faculty-specv2",
    name: "Spec Other Faculty",
    email: "test.other.faculty.specv2@caias.in",
    roles: ["faculty"],
    departmentId: otherDepartment.id,
  });
  otherFacultyCookie = await createTestSessionCookie({ userId: other.id, roles: ["faculty"], departmentId: otherDepartment.id });

  const hod = await upsertTestUser({ keycloakSub: "test-hod-specv2", name: "Spec HOD", email: "test.hod.specv2@caias.in", roles: ["hod"] });
  hodCookie = await createTestSessionCookie({ userId: hod.id, roles: ["hod"], departmentId });
  const admin = await upsertTestUser({ keycloakSub: "test-admin-specv2", name: "Spec CAIAS Admin", email: "test.admin.specv2@caias.in", roles: ["iiic_admin"] });
  adminCookie = await createTestSessionCookie({ userId: admin.id, roles: ["iiic_admin"] });
  const finance = await upsertTestUser({ keycloakSub: "test-finance-specv2", name: "Spec Finance", email: "test.finance.specv2@caias.in", roles: ["finance"] });
  financeCookie = await createTestSessionCookie({ userId: finance.id, roles: ["finance"] });

  await upsertTestApprovalStageConfig({
    id: "00000000-0000-0000-0000-0000000005c1",
    departmentId,
    stage: "hod_verification_pending",
    sequence: 1,
    approverRole: "hod",
  });
});

const json = (cookie: string, body?: unknown, method = "POST") => ({
  method,
  headers: { cookie, "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

async function createSubmitted() {
  const draftRes = await fetch(
    `${BASE_URL}/api/consultancies`,
    json(facultyCookie, {
      departmentId,
      academicYearCode: "2025-26",
      consultancyTypeCode: "individual_faculty",
      teamTypeCode: "single_faculty",
      title: "Spec Lifecycle Consultancy",
      consultancyAreaCode: "artificial_intelligence",
    })
  );
  const draft = (await draftRes.json()).data;
  await db.insert(documents).values({
    consultancyId: draft.id,
    documentCategory: "Signed Agreement",
    originalFileName: "agreement.pdf",
    objectKey: `test/${draft.id}/agreement.pdf`,
    status: "available",
    uploadedBy: facultyId,
  });
  const submitRes = await fetch(
    `${BASE_URL}/api/consultancies/${draft.id}/submit`,
    json(
      facultyCookie,
      withRegistrationDefaults({
        consultancy: {
          departmentId,
          academicYearCode: "2025-26",
          consultancyTypeCode: "individual_faculty",
          teamTypeCode: "single_faculty",
          title: "Spec Lifecycle Consultancy",
          consultancyAreaCode: "artificial_intelligence",
          startDate: "2026-01-01",
          expectedCompletionDate: "2026-06-01",
        },
        client: { organizationName: "Spec Client Org", organizationTypeCode: "private_company" },
        agreement: { agreementTypeCode: "work_order", agreementValue: "50000", paymentTermsCode: "milestone_based" },
        team: { members: [{ name: "Spec Test Faculty" }] },
        financial: { totalValue: "50000" },
        scope: { scopeOfWork: "Spec work.", deliverables: [{ name: "Final report" }] },
        resources: {},
      })
    )
  );
  assert.equal(submitRes.status, 200, await submitRes.clone().text());
  return draft.id as string;
}

async function createActive() {
  const id = await createSubmitted();
  await fetch(`${BASE_URL}/api/consultancies/${id}/verify`, json(hodCookie, { decision: "verify" }));
  const activateRes = await fetch(`${BASE_URL}/api/consultancies/${id}/activate`, json(adminCookie));
  assert.equal((await activateRes.json()).data.status, "active");
  return id;
}

async function requestClosure(id: string) {
  const [report] = await db
    .insert(documents)
    .values({
      consultancyId: id,
      documentCategory: "Final Report",
      originalFileName: "final.pdf",
      objectKey: `test/${id}/final.pdf`,
      status: "available",
      uploadedBy: facultyId,
    })
    .returning();
  const res = await fetch(
    `${BASE_URL}/api/consultancies/${id}/closures`,
    json(
      facultyCookie,
      withClosureDefaults({
        actualCompletionDate: "2026-05-01",
        deliverableCompletionStatus: "yes",
        finalOutcomes: "Delivered.",
        finalReportDocumentId: report.id,
      })
    )
  );
  assert.equal(res.status, 201, await res.clone().text());
  return (await res.json()).data as { id: string };
}

/** Pays the consultancy in full so the only open gate items are the ones a test cares about. */
async function payInFull(id: string) {
  const res = await fetch(
    `${BASE_URL}/api/consultancies/${id}/payment-transactions`,
    json(financeCookie, { amount: "50000", transactionDate: "2026-04-01", institutionalAccountRef: "CAIAS-01", transactionRef: `TX-${id.slice(0, 6)}` })
  );
  assert.equal(res.status, 201, await res.clone().text());
}

test("closure: Finance must verify the financial position before CAIAS can close, and only Finance may do so", async () => {
  const id = await createActive();
  await payInFull(id);
  const closure = await requestClosure(id);

  const blocked = await fetch(`${BASE_URL}/api/consultancies/${id}/closures/${closure.id}/verify`, json(adminCookie, { decision: "verified" }));
  assert.equal(blocked.status, 409);
  assert.match(JSON.stringify(await blocked.json()), /Finance has not yet verified/);

  const byFaculty = await fetch(`${BASE_URL}/api/consultancies/${id}/closures/${closure.id}/finance-verification`, json(facultyCookie, { status: "verified" }));
  assert.equal(byFaculty.status, 403);

  const discrepancyWithoutRemarks = await fetch(
    `${BASE_URL}/api/consultancies/${id}/closures/${closure.id}/finance-verification`,
    json(financeCookie, { status: "discrepancy" })
  );
  assert.equal(discrepancyWithoutRemarks.status, 400);

  await financeVerifyClosure(id, closure.id);
  const ok = await fetch(`${BASE_URL}/api/consultancies/${id}/closures/${closure.id}/verify`, json(adminCookie, { decision: "verified" }));
  assert.equal(ok.status, 200, await ok.clone().text());
  assert.equal((await ok.json()).data.consultancy.status, "completed_closed");
});

test("closure request enforces the spec's conditional fields (outcome reason, pending payment details, declaration)", async () => {
  const id = await createActive();
  const [report] = await db
    .insert(documents)
    .values({ consultancyId: id, documentCategory: "Final Report", originalFileName: "f.pdf", objectKey: `test/${id}/f.pdf`, status: "available", uploadedBy: facultyId })
    .returning();
  const base = { actualCompletionDate: "2026-05-01", deliverableCompletionStatus: "yes", finalOutcomes: "Done.", finalReportDocumentId: report.id };

  const terminatedNoReason = await fetch(`${BASE_URL}/api/consultancies/${id}/closures`, json(facultyCookie, withClosureDefaults({ ...base, finalOutcome: "terminated" })));
  assert.equal(terminatedNoReason.status, 400);

  const unpaidNoDetails = await fetch(`${BASE_URL}/api/consultancies/${id}/closures`, json(facultyCookie, withClosureDefaults({ ...base, fullPaymentReceived: false })));
  assert.equal(unpaidNoDetails.status, 400);

  const noDeclaration = await fetch(
    `${BASE_URL}/api/consultancies/${id}/closures`,
    json(facultyCookie, withClosureDefaults({ ...base, declaration: { informationTrue: false } }))
  );
  assert.equal(noDeclaration.status, 400);
});

test("client acceptance: a 'No' answer keeps the closure gate shut; feedback is recorded with a 1–5 rating", async () => {
  const id = await createActive();
  await db.update(consultancies).set({ clientAcceptanceRequired: true }).where(eq(consultancies.id, id));
  await payInFull(id);

  const missingRep = await fetch(`${BASE_URL}/api/consultancies/${id}/client-acceptance`, json(facultyCookie, { acceptanceStatus: "yes" }));
  assert.equal(missingRep.status, 400);
  const declined = await fetch(`${BASE_URL}/api/consultancies/${id}/client-acceptance`, json(facultyCookie, { acceptanceStatus: "no", remarks: "Client unhappy" }));
  assert.equal(declined.status, 201);

  const badRating = await fetch(`${BASE_URL}/api/consultancies/${id}/client-feedback`, json(facultyCookie, { feedbackDate: "2026-05-02", rating: 6 }));
  assert.equal(badRating.status, 400);
  const feedback = await fetch(`${BASE_URL}/api/consultancies/${id}/client-feedback`, json(facultyCookie, { feedbackDate: "2026-05-02", rating: 4, suggestions: "More demos" }));
  assert.equal(feedback.status, 201);

  const closure = await requestClosure(id);
  await financeVerifyClosure(id, closure.id);
  const blocked = await fetch(`${BASE_URL}/api/consultancies/${id}/closures/${closure.id}/verify`, json(adminCookie, { decision: "verified" }));
  assert.equal(blocked.status, 409);
  assert.match(JSON.stringify(await blocked.json()), /client has not accepted/);
});

test("reopen: rejected goes back to its rejecting stage, closed goes back to active — only CAIAS admin, always recorded", async () => {
  const rejectedId = await createSubmitted();
  const reject = await fetch(`${BASE_URL}/api/consultancies/${rejectedId}/verify`, json(hodCookie, { decision: "reject", comments: "Not in scope" }));
  assert.equal(reject.status, 200);

  const byFaculty = await fetch(`${BASE_URL}/api/consultancies/${rejectedId}/reopen`, json(facultyCookie, { reason: "Please" }));
  assert.equal(byFaculty.status, 403);
  const noReason = await fetch(`${BASE_URL}/api/consultancies/${rejectedId}/reopen`, json(adminCookie, { reason: " " }));
  assert.equal(noReason.status, 400);

  const reopened = await fetch(`${BASE_URL}/api/consultancies/${rejectedId}/reopen`, json(adminCookie, { reason: "Scope clarified with client" }));
  assert.equal(reopened.status, 200, await reopened.clone().text());
  const data = (await reopened.json()).data;
  assert.equal(data.status, "under_verification");
  assert.equal(data.workflowStage, "hod_verification_pending");

  const [log] = await db.select().from(reopenings).where(eq(reopenings.consultancyId, rejectedId));
  assert.equal(log.previousStatus, "rejected");
  assert.equal(log.newStatus, "under_verification");
  const audit = await db
    .select()
    .from(auditEvents)
    .where(and(eq(auditEvents.consultancyId, rejectedId), eq(auditEvents.action, "reopened")));
  assert.equal(audit.length, 1);
  assert.equal(audit[0].comments, "Scope clarified with client");

  const activeId = await createActive();
  const notClosed = await fetch(`${BASE_URL}/api/consultancies/${activeId}/reopen`, json(adminCookie, { reason: "x" }));
  assert.equal(notClosed.status, 409);
});

test("archive: only finished records, hidden from default search but still fully readable, and restorable", async () => {
  const activeId = await createActive();
  const tooEarly = await fetch(`${BASE_URL}/api/consultancies/${activeId}/archive`, json(adminCookie, { reason: "Retention" }));
  assert.equal(tooEarly.status, 409);

  const rejectedId = await createSubmitted();
  await fetch(`${BASE_URL}/api/consultancies/${rejectedId}/verify`, json(hodCookie, { decision: "reject", comments: "No" }));
  const archived = await fetch(`${BASE_URL}/api/consultancies/${rejectedId}/archive`, json(adminCookie, { reason: "Retention policy" }));
  assert.equal(archived.status, 200);
  const code = (await archived.json()).data.consultancyCode;

  const defaultSearch = await (await fetch(`${BASE_URL}/api/consultancies/search?q=${encodeURIComponent(code)}`, json(adminCookie, undefined, "GET"))).json();
  assert.equal(defaultSearch.total, 0);
  const withArchived = await (await fetch(`${BASE_URL}/api/consultancies/search?q=${encodeURIComponent(code)}&archived=include`, json(adminCookie, undefined, "GET"))).json();
  assert.equal(withArchived.total, 1);

  const stillReadable = await fetch(`${BASE_URL}/api/consultancies/${rejectedId}`, json(adminCookie, undefined, "GET"));
  assert.equal(stillReadable.status, 200);

  const restored = await fetch(`${BASE_URL}/api/consultancies/${rejectedId}/archive`, json(adminCookie, undefined, "DELETE"));
  assert.equal(restored.status, 200);
  assert.equal((await restored.json()).data.archivedAt, null);
});

test("approval configuration: CAIAS admin manages rules (audited); faculty cannot; conditional rules only apply when their condition holds", async () => {
  const denied = await fetch(`${BASE_URL}/api/approval-configs`, json(facultyCookie, { stage: "caias_verification_pending", approverRole: "iiic_admin", sequence: 2 }));
  assert.equal(denied.status, 403);

  const created = await fetch(
    `${BASE_URL}/api/approval-configs`,
    json(adminCookie, { stage: "competent_authority_approval_pending", approverRole: "competent_authority", sequence: 9, departmentId, whenIpOrConfidential: true })
  );
  assert.equal(created.status, 201, await created.clone().text());
  const rule = (await created.json()).data;
  const audit = await db
    .select()
    .from(auditEvents)
    .where(and(eq(auditEvents.entityType, "approval_config"), eq(auditEvents.entityId, rule.id)));
  assert.equal(audit.length, 1);

  const input = { departmentId, consultancyAreaCode: "x", totalValue: "100" };
  assert.equal(selectApprovalChain([rule], { ...input, ipOrConfidential: false }).length, 0);
  assert.equal(selectApprovalChain([rule], { ...input, ipOrConfidential: true }).length, 1);

  const removed = await fetch(`${BASE_URL}/api/approval-configs/${rule.id}`, json(adminCookie, undefined, "DELETE"));
  assert.equal(removed.status, 200);
});

test("record access: faculty of another department cannot read a consultancy; its own department can", async () => {
  const id = await createSubmitted();
  const outsider = await fetch(`${BASE_URL}/api/consultancies/${id}`, json(otherFacultyCookie, undefined, "GET"));
  assert.equal(outsider.status, 404);
  const outsiderDocs = await fetch(`${BASE_URL}/api/consultancies/${id}/documents`, json(otherFacultyCookie, undefined, "GET"));
  assert.equal(outsiderDocs.status, 404);
  const own = await fetch(`${BASE_URL}/api/consultancies/${id}`, json(facultyCookie, undefined, "GET"));
  assert.equal(own.status, 200);
});

test("register: closed records carry the spec §39 fields, and the CSV download has every column", async () => {
  const id = await createActive();
  await payInFull(id);
  const closure = await requestClosure(id);
  await financeVerifyClosure(id, closure.id);
  await fetch(`${BASE_URL}/api/consultancies/${id}/closures/${closure.id}/verify`, json(adminCookie, { decision: "verified" }));

  const register = await (await fetch(`${BASE_URL}/api/consultancies/register`, json(facultyCookie, undefined, "GET"))).json();
  const entry = register.data.find((e: { consultancyId: string }) => e.consultancyId === id);
  assert.ok(entry);
  assert.equal(entry.agreementReference, "AGR-TEST-001");
  assert.equal(entry.amountReceived, 50000);
  assert.equal(entry.finalOutcomes, "Delivered.", "outcomes come from the verified closure");
  assert.ok(entry.closureDate);
  assert.match(entry.finalReportReference, /\(v1\)$/);

  const csv = await (await fetch(`${BASE_URL}/api/consultancies/register?format=csv`, json(facultyCookie, undefined, "GET"))).text();
  assert.match(csv.split("\n")[0], /^Consultancy ID,Academic Year,Department,Consultant,Client,Consultancy Title,Consultancy Type,Start Date,Completion Date,Consultancy Value,Amount Received,Status,Agreement Reference,IP Involved,CAIAS Resources Used,Closure Date,Client Feedback,Final Report,Remarks/);
});

test("KPI presets: closure_pending and finance_pending list exactly the records waiting on those steps", async () => {
  const id = await createActive();
  await payInFull(id);
  const closure = await requestClosure(id);
  const code = (await (await fetch(`${BASE_URL}/api/consultancies/${id}`, json(adminCookie, undefined, "GET"))).json()).data.consultancy.consultancyCode;

  const search = async (preset: string) =>
    (await (await fetch(`${BASE_URL}/api/consultancies/search?preset=${preset}&q=${encodeURIComponent(code)}`, json(adminCookie, undefined, "GET"))).json()).total;
  assert.equal(await search("closure_pending"), 1);
  assert.equal(await search("finance_pending"), 1);

  await financeVerifyClosure(id, closure.id);
  assert.equal(await search("finance_pending"), 0);
  assert.equal(await search("closure_pending"), 1);
});
