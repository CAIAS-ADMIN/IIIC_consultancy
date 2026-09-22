import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { createTestSessionCookie } from "./helpers/session";
import { upsertTestUser, upsertTestDepartment, upsertTestApprovalStageConfig, BASE_URL } from "./helpers/fixtures";
import { closeDb, db } from "@/db";
import { auditEvents, documents } from "@/db/schema";

// Phase 13 (security, audit completeness & hardening) coverage:
//  - a full-lifecycle audit trail (draft -> submit -> verify -> activate ->
//    progress -> payment -> closure) is gapless
//  - every mutation endpoint rejects an unauthenticated caller, and one
//    holding no accepted role, as a single automated matrix rather than
//    manual spot-checks
//  - the document presign/confirm path rejects disallowed content types and
//    oversized uploads server-side
//  - the Consultancy ID generation path (submit) is rate-limited

const FAKE_ID = "00000000-0000-0000-0000-000000000000";

let departmentId: string;
let facultyId: string;
let facultyCookie: string;
let hodCookie: string;
let iiicAdminCookie: string;
let financeCookie: string;
let auditReadonlyCookie: string;

after(async () => {
  await closeDb();
});

before(async () => {
  const department = await upsertTestDepartment({ code: "PHASE13DEPT", name: "Phase 13 Test Dept" });
  departmentId = department.id;

  const faculty = await upsertTestUser({
    keycloakSub: "test-faculty-phase13",
    name: "Phase 13 Test Faculty",
    email: "test.faculty.phase13@caias.in",
    roles: ["faculty"],
  });
  facultyId = faculty.id;
  facultyCookie = await createTestSessionCookie({ userId: faculty.id, roles: ["faculty"] });

  const hod = await upsertTestUser({
    keycloakSub: "test-hod-phase13",
    name: "Phase 13 Test HOD",
    email: "test.hod.phase13@caias.in",
    roles: ["hod"],
  });
  hodCookie = await createTestSessionCookie({ userId: hod.id, roles: ["hod"] });

  const iiicAdmin = await upsertTestUser({
    keycloakSub: "test-iiicadmin-phase13",
    name: "Phase 13 Test IIIC Admin",
    email: "test.iiicadmin.phase13@caias.in",
    roles: ["iiic_admin"],
  });
  iiicAdminCookie = await createTestSessionCookie({ userId: iiicAdmin.id, roles: ["iiic_admin"] });

  const finance = await upsertTestUser({
    keycloakSub: "test-finance-phase13",
    name: "Phase 13 Test Finance",
    email: "test.finance.phase13@caias.in",
    roles: ["finance"],
  });
  financeCookie = await createTestSessionCookie({ userId: finance.id, roles: ["finance"] });

  // audit_readonly holds no write permission anywhere in the system — the
  // canonical "wrong role" caller for the rejection matrix below.
  const auditReadonly = await upsertTestUser({
    keycloakSub: "test-auditreadonly-phase13",
    name: "Phase 13 Test Audit Readonly",
    email: "test.auditreadonly.phase13@caias.in",
    roles: ["audit_readonly"],
  });
  auditReadonlyCookie = await createTestSessionCookie({ userId: auditReadonly.id, roles: ["audit_readonly"] });

  await upsertTestApprovalStageConfig({
    id: randomUUID(),
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
      title: "Phase 13 Test Consultancy",
      consultancyAreaCode: "artificial_intelligence",
      startDate: "2026-01-01",
      expectedCompletionDate: "2026-06-01",
    },
    client: { organizationName: "Phase 13 Client Org", organizationTypeCode: "private_company" },
    agreement: { agreementTypeCode: "work_order", agreementValue: "50000", paymentTermsCode: "milestone_based" },
    team: { members: [{ name: "Phase 13 Test Faculty", role: "Principal Investigator" }] },
    financial: { totalValue: "50000" },
    scope: { scopeOfWork: "Build a test integration.", deliverables: [{ description: "Final report" }] },
    resources: {},
    ...overrides,
  };
}

async function createDraft(title: string) {
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
  assert.equal(res.status, 201);
  return (await res.json()).data;
}

async function attachSignedAgreement(consultancyId: string) {
  await db.insert(documents).values({
    consultancyId,
    documentCategory: "Signed Agreement",
    originalFileName: "agreement.pdf",
    objectKey: `test/${consultancyId}/agreement.pdf`,
    status: "available",
    uploadedBy: facultyId,
  });
}

async function submit(consultancyId: string, cookie = facultyCookie, overrides: Record<string, unknown> = {}) {
  return fetch(`${BASE_URL}/api/consultancies/${consultancyId}/submit`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(validSubmitPayload(overrides)),
  });
}

async function createActiveConsultancy(title: string) {
  const draft = await createDraft(title);
  await attachSignedAgreement(draft.id);
  const submitRes = await submit(draft.id);
  assert.equal(submitRes.status, 200);
  const verifyRes = await fetch(`${BASE_URL}/api/consultancies/${draft.id}/verify`, {
    method: "POST",
    headers: { cookie: hodCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "verify" }),
  });
  assert.equal(verifyRes.status, 200);
  const activateRes = await fetch(`${BASE_URL}/api/consultancies/${draft.id}/activate`, {
    method: "POST",
    headers: { cookie: iiicAdminCookie, "content-type": "application/json" },
  });
  assert.equal(activateRes.status, 200);
  return (await activateRes.json()).data;
}

async function createClarificationConsultancy(title: string) {
  const draft = await createDraft(title);
  await attachSignedAgreement(draft.id);
  const submitRes = await submit(draft.id);
  assert.equal(submitRes.status, 200);
  const returnRes = await fetch(`${BASE_URL}/api/consultancies/${draft.id}/verify`, {
    method: "POST",
    headers: { cookie: hodCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "return", comments: "fix title", flaggedFields: ["title"] }),
  });
  assert.equal(returnRes.status, 200);
  return (await returnRes.json()).data;
}

// --- Task 3: full-lifecycle audit trail is gapless ---

test("the full lifecycle (draft -> submit -> verify -> activate -> progress -> payment -> closure) produces a gapless audit trail", async () => {
  const draft = await createDraft("Phase 13 Lifecycle Audit Consultancy");

  // Real presign -> PUT -> confirm round trip (not a direct db insert) so this
  // also exercises the Task 4 upload validation and produces its own audit row.
  const presignRes = await fetch(`${BASE_URL}/api/documents/presign`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      consultancyId: draft.id,
      documentCategory: "Signed Agreement",
      originalFileName: "agreement.pdf",
      contentType: "application/pdf",
      fileSizeBytes: 2048,
    }),
  });
  assert.equal(presignRes.status, 200);
  const { uploadUrl, objectKey } = (await presignRes.json()).data;
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    body: Buffer.from("signed agreement bytes"),
    headers: { "content-type": "application/pdf" },
  });
  assert.equal(putRes.status, 200);
  const confirmRes = await fetch(`${BASE_URL}/api/documents/confirm`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      consultancyId: draft.id,
      objectKey,
      documentCategory: "Signed Agreement",
      originalFileName: "agreement.pdf",
      confidentialityLevel: "internal",
    }),
  });
  assert.equal(confirmRes.status, 201);

  const submitRes = await submit(draft.id);
  assert.equal(submitRes.status, 200);

  const verifyRes = await fetch(`${BASE_URL}/api/consultancies/${draft.id}/verify`, {
    method: "POST",
    headers: { cookie: hodCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "verify" }),
  });
  assert.equal(verifyRes.status, 200);

  const activateRes = await fetch(`${BASE_URL}/api/consultancies/${draft.id}/activate`, {
    method: "POST",
    headers: { cookie: iiicAdminCookie, "content-type": "application/json" },
  });
  assert.equal(activateRes.status, 200);

  const progressRes = await fetch(`${BASE_URL}/api/consultancies/${draft.id}/progress-updates`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      reportDate: "2026-02-01",
      reportingPeriodStart: "2026-01-01",
      reportingPeriodEnd: "2026-01-31",
      status: "on_track",
      overallProgressPercent: 50,
    }),
  });
  assert.equal(progressRes.status, 201);

  const paymentRes = await fetch(`${BASE_URL}/api/consultancies/${draft.id}/payment-transactions`, {
    method: "POST",
    headers: { cookie: financeCookie, "content-type": "application/json" },
    body: JSON.stringify({
      amount: "50000",
      transactionDate: "2026-04-01",
      institutionalAccountRef: "ACC-1",
      transactionRef: "TXN-LIFECYCLE-AUDIT",
    }),
  });
  assert.equal(paymentRes.status, 201);

  const [finalReportDoc] = await db
    .insert(documents)
    .values({
      consultancyId: draft.id,
      documentCategory: "Deliverable",
      originalFileName: "final-report.pdf",
      objectKey: `test/${draft.id}/final-report.pdf`,
      status: "available",
      uploadedBy: facultyId,
    })
    .returning();

  const closureRes = await fetch(`${BASE_URL}/api/consultancies/${draft.id}/closures`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      actualCompletionDate: "2026-05-01",
      deliverableCompletionStatus: "yes",
      finalOutcomes: "All deliverables completed.",
      finalReportDocumentId: finalReportDoc.id,
    }),
  });
  assert.equal(closureRes.status, 201);
  const closure = (await closureRes.json()).data;

  const closureVerifyRes = await fetch(`${BASE_URL}/api/consultancies/${draft.id}/closures/${closure.id}/verify`, {
    method: "POST",
    headers: { cookie: iiicAdminCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "verified" }),
  });
  assert.equal(closureVerifyRes.status, 200);

  const events = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.consultancyId, draft.id))
    .orderBy(asc(auditEvents.createdAt));

  const actions = events.map((e) => `${e.entityType}:${e.action}`);
  assert.deepEqual(actions, [
    "consultancy:draft_created",
    "document:uploaded",
    "consultancy:submitted",
    "consultancy:verified",
    "consultancy:activated",
    "progress_update:progress_update_added",
    "payment_transaction:payment_transaction_recorded",
    "closure:closure_requested",
    "closure:closure_verified",
  ]);
  // every row is attributable to a real actor — no anonymous/unattributed mutation
  assert.ok(events.every((e) => e.actorId !== null));
});

// --- Tasks 1 & 2 (as an automated suite, not manual spot-checks): every
// mutation endpoint rejects a caller with no session, and one holding no
// accepted role. ---

type Endpoint = { method: string; path: string; body?: unknown };

test("every mutation endpoint rejects a request with no session (401)", async () => {
  const endpoints: Endpoint[] = [
    { method: "POST", path: "/api/consultancies", body: {} },
    { method: "PATCH", path: `/api/consultancies/${FAKE_ID}`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/submit`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/verify`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/activate` },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/cancel`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/resume` },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/terminate`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/hold`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/resubmit` },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/extensions`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/extensions/${FAKE_ID}/decide`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/milestones`, body: {} },
    { method: "PATCH", path: `/api/consultancies/${FAKE_ID}/milestones/${FAKE_ID}`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/progress-updates`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/payment-schedules`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/payment-transactions`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/payment-adjustments`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/client-acceptance`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/closures`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/closures/${FAKE_ID}/verify`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/closures/${FAKE_ID}/exception`, body: {} },
    { method: "POST", path: "/api/documents/presign", body: {} },
    { method: "POST", path: "/api/documents/confirm", body: {} },
    { method: "POST", path: "/api/master-data", body: {} },
    { method: "PATCH", path: `/api/master-data/${FAKE_ID}`, body: {} },
  ];

  const failures: string[] = [];
  for (const ep of endpoints) {
    const res = await fetch(`${BASE_URL}${ep.path}`, {
      method: ep.method,
      headers: { "content-type": "application/json" },
      body: ep.body !== undefined ? JSON.stringify(ep.body) : undefined,
    });
    if (res.status !== 401) {
      failures.push(`${ep.method} ${ep.path} -> ${res.status} (expected 401)`);
    }
  }
  assert.deepEqual(failures, []);
});

test("every mutation endpoint rejects a caller holding no accepted role (403)", async () => {
  const activeConsultancy = await createActiveConsultancy("Phase 13 Role-Matrix Active Consultancy");
  const draftForPatch = await createDraft("Phase 13 Role-Matrix Draft Consultancy");
  const clarificationConsultancy = await createClarificationConsultancy("Phase 13 Role-Matrix Clarification Consultancy");
  const activeId = activeConsultancy.id;

  // Under verification, hod_verification_pending stage — verify's role gate
  // is resolved dynamically from approval_stage_configs, not a static list.
  const underVerificationDraft = await createDraft("Phase 13 Role-Matrix Under-Verification Consultancy");
  await attachSignedAgreement(underVerificationDraft.id);
  const underVerificationSubmitRes = await submit(underVerificationDraft.id);
  assert.equal(underVerificationSubmitRes.status, 200);

  // Role-gated endpoints (requireRole runs before any resource lookup) — a
  // nonexistent id is fine, the caller is rejected before it would ever be read.
  const roleGated: Endpoint[] = [
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/activate` },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/cancel`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/resume` },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/terminate`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/hold`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/extensions/${FAKE_ID}/decide`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/payment-schedules`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/payment-transactions`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/payment-adjustments`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/closures/${FAKE_ID}/verify`, body: {} },
    { method: "POST", path: `/api/consultancies/${FAKE_ID}/closures/${FAKE_ID}/exception`, body: {} },
    { method: "POST", path: "/api/master-data", body: {} },
    { method: "PATCH", path: `/api/master-data/${FAKE_ID}`, body: {} },
    // audit_readonly is not faculty/hod/iiic_admin/system_admin either
    { method: "POST", path: "/api/consultancies", body: {} },
  ];

  // Ownership/membership-gated endpoints — need a real resource in the right
  // status so the caller actually reaches the membership check.
  const membershipGated: Endpoint[] = [
    { method: "PATCH", path: `/api/consultancies/${draftForPatch.id}`, body: { title: "hijacked" } },
    { method: "POST", path: `/api/consultancies/${draftForPatch.id}/submit`, body: {} },
    { method: "POST", path: `/api/consultancies/${underVerificationDraft.id}/verify`, body: { decision: "verify" } },
    { method: "POST", path: `/api/consultancies/${activeId}/milestones`, body: {} },
    { method: "PATCH", path: `/api/consultancies/${activeId}/milestones/${FAKE_ID}`, body: {} },
    { method: "POST", path: `/api/consultancies/${activeId}/progress-updates`, body: {} },
    { method: "POST", path: `/api/consultancies/${activeId}/extensions`, body: {} },
    { method: "POST", path: `/api/consultancies/${activeId}/closures`, body: {} },
    { method: "POST", path: `/api/consultancies/${activeId}/client-acceptance`, body: {} },
    { method: "POST", path: `/api/consultancies/${clarificationConsultancy.id}/resubmit` },
    { method: "POST", path: "/api/documents/presign", body: { consultancyId: activeId, documentCategory: "x", originalFileName: "a.pdf", contentType: "application/pdf", fileSizeBytes: 10 } },
    { method: "POST", path: "/api/documents/confirm", body: { consultancyId: activeId, objectKey: `consultancies/${activeId}/x.pdf`, documentCategory: "x", originalFileName: "a.pdf" } },
  ];

  const failures: string[] = [];
  for (const ep of [...roleGated, ...membershipGated]) {
    const res = await fetch(`${BASE_URL}${ep.path}`, {
      method: ep.method,
      headers: { cookie: auditReadonlyCookie, "content-type": "application/json" },
      body: ep.body !== undefined ? JSON.stringify(ep.body) : undefined,
    });
    if (res.status !== 403) {
      failures.push(`${ep.method} ${ep.path} -> ${res.status} (expected 403)`);
    }
  }
  assert.deepEqual(failures, []);
});

// --- Task 4: file-type validation and size limits, enforced server-side ---

test("presign rejects a disallowed content type and an oversized declared file size", async () => {
  const draft = await createDraft("Phase 13 Upload Validation Consultancy");

  const badType = await fetch(`${BASE_URL}/api/documents/presign`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      consultancyId: draft.id,
      documentCategory: "Signed Agreement",
      originalFileName: "malware.exe",
      contentType: "application/x-msdownload",
      fileSizeBytes: 1024,
    }),
  });
  assert.equal(badType.status, 400);

  const tooLarge = await fetch(`${BASE_URL}/api/documents/presign`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      consultancyId: draft.id,
      documentCategory: "Signed Agreement",
      originalFileName: "huge.pdf",
      contentType: "application/pdf",
      fileSizeBytes: 26 * 1024 * 1024,
    }),
  });
  assert.equal(tooLarge.status, 400);
});

test("confirm rejects an upload whose actual bytes exceed the server-side size cap, even if the declared size passed presign", async () => {
  const draft = await createDraft("Phase 13 Oversized Upload Consultancy");

  const presignRes = await fetch(`${BASE_URL}/api/documents/presign`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      consultancyId: draft.id,
      documentCategory: "Signed Agreement",
      originalFileName: "agreement.pdf",
      contentType: "application/pdf",
      fileSizeBytes: 1024, // declared small — the client lied
    }),
  });
  assert.equal(presignRes.status, 200);
  const { uploadUrl, objectKey } = (await presignRes.json()).data;

  const oversizedBytes = Buffer.alloc(26 * 1024 * 1024, 1); // actually upload 26MB, over the 25MB cap
  const putRes = await fetch(uploadUrl, { method: "PUT", body: oversizedBytes, headers: { "content-type": "application/pdf" } });
  assert.equal(putRes.status, 200); // RustFS itself doesn't cap this — our confirm step must

  const confirmRes = await fetch(`${BASE_URL}/api/documents/confirm`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      consultancyId: draft.id,
      objectKey,
      documentCategory: "Signed Agreement",
      originalFileName: "agreement.pdf",
      confidentialityLevel: "internal",
    }),
  });
  assert.equal(confirmRes.status, 413);
});

// --- Task 6: rate-limit the Consultancy ID generation path ---

test("the submit endpoint (Consultancy ID generation) rate-limits a single caller", async () => {
  // Unique identity per run: the rate limiter's window lives in the (long-running,
  // shared) dev server process, not this test process, so a deterministic identity
  // would collide with a previous run's count if re-run inside the same 5-minute window.
  const uniqueSuffix = Date.now();
  const rateLimitFaculty = await upsertTestUser({
    keycloakSub: `test-faculty-phase13-ratelimit-${uniqueSuffix}`,
    name: "Phase 13 Rate Limit Faculty",
    email: `test.faculty.phase13.ratelimit.${uniqueSuffix}@caias.in`,
    roles: ["faculty"],
  });
  const rateLimitCookie = await createTestSessionCookie({ userId: rateLimitFaculty.id, roles: ["faculty"] });

  const SUBMIT_RATE_LIMIT = 50; // must match src/app/api/consultancies/[id]/submit/route.ts
  const attempts = SUBMIT_RATE_LIMIT + 5;
  let succeeded = 0;
  let rateLimited = 0;

  for (let i = 0; i < attempts; i++) {
    const draftRes = await fetch(`${BASE_URL}/api/consultancies`, {
      method: "POST",
      headers: { cookie: rateLimitCookie, "content-type": "application/json" },
      body: JSON.stringify({
        departmentId,
        academicYearCode: "2025-26",
        consultancyTypeCode: "individual_faculty",
        teamTypeCode: "single_faculty",
        title: `Phase 13 Rate Limit Draft ${i}`,
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
      uploadedBy: rateLimitFaculty.id,
    });

    const submitRes = await submit(draft.id, rateLimitCookie);
    if (submitRes.status === 200) succeeded++;
    if (submitRes.status === 429) rateLimited++;
  }

  assert.equal(succeeded, SUBMIT_RATE_LIMIT);
  assert.equal(rateLimited, attempts - SUBMIT_RATE_LIMIT);
});
