import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSessionCookie } from "./helpers/session";
import { upsertTestUser, upsertTestDepartment, upsertTestApprovalStageConfig, BASE_URL, withRegistrationDefaults } from "./helpers/fixtures";
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
  return withRegistrationDefaults({
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
  });
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

test("PATCH on a draft persists team members, deliverables, and involved departments (not just plain consultancy/client/agreement fields)", async () => {
  const otherDept = await upsertTestDepartment({ code: "TESTDEPT2", name: "Test Department 2" });
  const draft = await createDraft();

  const patchRes = await fetch(`${BASE_URL}/api/consultancies/${draft.id}`, {
    method: "PATCH",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      teamMembers: [
        { name: "Registration Test Faculty", role: "Principal Investigator" },
        { name: "Co-Investigator", role: "Co-Investigator", isExternal: true },
      ],
      deliverables: [{ description: "Interim report" }, { description: "Final report", dueDate: "2026-06-01" }],
      departmentsInvolved: [departmentId, otherDept.id],
    }),
  });
  assert.equal(patchRes.status, 200);

  const getRes = await fetch(`${BASE_URL}/api/consultancies/${draft.id}`, { headers: { cookie: facultyCookie } });
  const body = await getRes.json();
  assert.equal(body.data.teamMembers.length, 2);
  assert.ok(body.data.teamMembers.some((m: { name: string }) => m.name === "Co-Investigator"));
  assert.equal(body.data.deliverables.length, 2);
  assert.deepEqual(body.data.departmentsInvolved.sort(), [departmentId, otherDept.id].sort());

  // A second save (delete-then-reinsert) replaces rather than accumulates.
  const secondPatchRes = await fetch(`${BASE_URL}/api/consultancies/${draft.id}`, {
    method: "PATCH",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      teamMembers: [{ name: "Registration Test Faculty", role: "Principal Investigator" }],
      deliverables: [{ description: "Final report" }],
      departmentsInvolved: [departmentId],
    }),
  });
  assert.equal(secondPatchRes.status, 200);
  const getRes2 = await fetch(`${BASE_URL}/api/consultancies/${draft.id}`, { headers: { cookie: facultyCookie } });
  const body2 = await getRes2.json();
  assert.equal(body2.data.teamMembers.length, 1);
  assert.equal(body2.data.deliverables.length, 1);
  assert.deepEqual(body2.data.departmentsInvolved, [departmentId]);
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

async function draftWithSignedAgreement() {
  const draft = await createDraft();
  await db.insert(documents).values({
    consultancyId: draft.id,
    documentCategory: "Signed Agreement",
    originalFileName: "agreement.pdf",
    objectKey: `consultancies/${draft.id}/signed-agreement/v1.pdf`,
    uploadedBy: facultyId,
    status: "available",
  });
  return draft;
}

async function submit(id: string, payload: unknown) {
  const res = await fetch(`${BASE_URL}/api/consultancies/${id}/submit`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json() };
}

function errorPaths(body: { error?: { fieldErrors?: Record<string, unknown>; formErrors?: unknown } }): string {
  return JSON.stringify(body.error);
}

test("portal spec: submit is refused while the agreement is marked as not yet signed", async () => {
  const draft = await draftWithSignedAgreement();
  const base = validSubmitPayload();
  const { status, body } = await submit(draft.id, { ...base, consultancy: { ...base.consultancy, agreementSignedStatus: "no" } });
  assert.equal(status, 400);
  assert.match(errorPaths(body), /written agreement/);
});

test("portal spec: the declaration must be fully confirmed", async () => {
  const draft = await draftWithSignedAgreement();
  const base = validSubmitPayload() as Record<string, Record<string, unknown>>;
  const { status } = await submit(draft.id, { ...base, declaration: { ...base.declaration, paymentsRouted: false } });
  assert.equal(status, 400);
});

test("portal spec: payment schedule must total the consultancy value", async () => {
  const draft = await draftWithSignedAgreement();
  const { status, body } = await submit(
    draft.id,
    validSubmitPayload({
      financial: { totalValue: "50000", paymentSchedule: [{ stageLabel: "Advance", plannedAmount: "20000", plannedDate: "2026-02-01" }] },
    })
  );
  assert.equal(status, 400);
  assert.match(errorPaths(body), /must match/);
});

test("portal spec: exactly one Principal Consultant, and contribution percentages must total 100", async () => {
  const base = validSubmitPayload();
  const noPrincipal = await submit((await draftWithSignedAgreement()).id, {
    ...base,
    team: { members: [{ name: "A", role: "co_consultant", department: "X" }] },
  });
  assert.equal(noPrincipal.status, 400);
  assert.match(errorPaths(noPrincipal.body), /Principal Consultant is required/);

  const twoPrincipals = await submit((await draftWithSignedAgreement()).id, {
    ...base,
    team: {
      members: [
        { name: "A", role: "principal_consultant", department: "X" },
        { name: "B", role: "principal_consultant", department: "X" },
      ],
    },
  });
  assert.equal(twoPrincipals.status, 400);

  const badPct = await submit((await draftWithSignedAgreement()).id, {
    ...base,
    team: {
      members: [
        { name: "A", role: "principal_consultant", department: "X", contributionPercent: "60" },
        { name: "B", role: "co_consultant", department: "X", contributionPercent: "30" },
      ],
    },
  });
  assert.equal(badPct.status, 400);
  assert.match(errorPaths(badPct.body), /total 100%/);
});

test("portal spec: IP = Yes and confidentiality without an NDA make their detail fields mandatory", async () => {
  const ipRes = await submit((await draftWithSignedAgreement()).id, validSubmitPayload({ resources: { ipExpected: "yes" } }));
  assert.equal(ipRes.status, 400);
  assert.match(errorPaths(ipRes.body), /Ownership is required/);

  const confRes = await submit(
    (await draftWithSignedAgreement()).id,
    validSubmitPayload({ resources: { ipExpected: "no", confidentialInformation: true, ndaAvailable: false } })
  );
  assert.equal(confRes.status, 400);
  assert.match(errorPaths(confRes.body), /without an NDA/);
});

test("portal spec: a full submission stores milestones, payment schedule, IP detail and the declaration", async () => {
  const draft = await draftWithSignedAgreement();
  const { status, body } = await submit(
    draft.id,
    validSubmitPayload({
      financial: {
        totalValue: "50000",
        paymentSchedule: [
          { stageLabel: "Advance", plannedAmount: "20000", plannedDate: "2099-01-01" },
          { stageLabel: "Final", plannedAmount: "30000", plannedDate: "2099-06-01" },
        ],
      },
      timeline: {
        milestones: [
          { title: "Requirement Analysis", description: "Gather needs", startDate: "2026-01-01", plannedDate: "2026-02-01", responsiblePerson: "A" },
        ],
      },
      resources: {
        ipExpected: "yes",
        ipTypeCodes: ["software"],
        ipOwnership: "Joint",
        ipCommercialisationRights: "Client",
        ipRegistrationResponsibility: "CAIAS",
      },
    })
  );
  assert.equal(status, 200, JSON.stringify(body));

  const res = await fetch(`${BASE_URL}/api/consultancies/${draft.id}`, { headers: { cookie: facultyCookie } });
  const data = (await res.json()).data;
  assert.equal(data.milestones.length, 1);
  assert.equal(data.milestones[0].responsiblePerson, "A");
  assert.deepEqual(data.paymentSchedule.map((p: { stageLabel: string }) => p.stageLabel).sort(), ["Advance", "Final"]);
  assert.equal(data.consultancy.ipExpected, "yes");
  assert.equal(data.consultancy.ipAgreementRequired, true, "IP = Yes implies the IP-agreement document requirement");
  assert.equal(data.consultancy.declarationAcceptedBy, facultyId);
  assert.ok(data.consultancy.declarationAcceptedAt);
});

test("draft PATCH ignores system fields (status, workflow, code, lock) and foreign keys in nested sections", async () => {
  const draft = await createDraft();
  const other = await createDraft();

  const res = await fetch(`${BASE_URL}/api/consultancies/${draft.id}`, {
    method: "PATCH",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      title: "Renamed draft",
      status: "registered",
      workflowStage: "verification_complete",
      consultancyCode: "CAIAS/CON/2025-26/99999",
      isLocked: true,
      client: { organizationName: "Org", organizationTypeCode: "private_company", consultancyId: other.id },
    }),
  });
  assert.equal(res.status, 200);
  const updated = (await res.json()).data;
  assert.equal(updated.title, "Renamed draft");
  assert.equal(updated.status, "draft");
  assert.equal(updated.workflowStage, "none");
  assert.equal(updated.consultancyCode, null);
  assert.equal(updated.isLocked, false);

  const otherRes = await fetch(`${BASE_URL}/api/consultancies/${other.id}`, { headers: { cookie: facultyCookie } });
  assert.ok(!(await otherRes.json()).data.client, "the other draft must not have gained a client row");
});
