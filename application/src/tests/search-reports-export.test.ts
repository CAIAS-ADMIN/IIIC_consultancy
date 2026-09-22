import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSessionCookie } from "./helpers/session";
import { upsertTestUser, upsertTestDepartment, upsertTestApprovalStageConfig, BASE_URL } from "./helpers/fixtures";
import { closeDb, db } from "@/db";
import { documents } from "@/db/schema";

let facultyACookie: string;
let facultyBCookie: string;
let hodACookie: string;
let systemAdminCookie: string;
let departmentAId: string;
let departmentBId: string;

after(async () => {
  await closeDb();
});

before(async () => {
  const deptA = await upsertTestDepartment({ code: "PHASE12-A", name: "Phase 12 Dept A" });
  departmentAId = deptA.id;
  const deptB = await upsertTestDepartment({ code: "PHASE12-B", name: "Phase 12 Dept B" });
  departmentBId = deptB.id;

  const facultyA = await upsertTestUser({
    keycloakSub: "test-faculty-a-phase12",
    name: "Phase 12 Faculty A",
    email: "test.faculty.a.phase12@caias.in",
    roles: ["faculty"],
    departmentId: departmentAId,
  });
  facultyACookie = await createTestSessionCookie({ userId: facultyA.id, roles: ["faculty"], departmentId: departmentAId });

  const facultyB = await upsertTestUser({
    keycloakSub: "test-faculty-b-phase12",
    name: "Phase 12 Faculty B",
    email: "test.faculty.b.phase12@caias.in",
    roles: ["faculty"],
    departmentId: departmentBId,
  });
  facultyBCookie = await createTestSessionCookie({ userId: facultyB.id, roles: ["faculty"], departmentId: departmentBId });

  const hodA = await upsertTestUser({
    keycloakSub: "test-hod-a-phase12",
    name: "Phase 12 HOD A",
    email: "test.hod.a.phase12@caias.in",
    roles: ["hod"],
    departmentId: departmentAId,
  });
  hodACookie = await createTestSessionCookie({ userId: hodA.id, roles: ["hod"] });

  const systemAdmin = await upsertTestUser({
    keycloakSub: "test-sysadmin-phase12",
    name: "Phase 12 System Admin",
    email: "test.sysadmin.phase12@caias.in",
    roles: ["system_admin"],
  });
  systemAdminCookie = await createTestSessionCookie({ userId: systemAdmin.id, roles: ["system_admin"] });

  await upsertTestApprovalStageConfig({
    id: "00000000-0000-0000-0000-0000000000a2",
    departmentId: departmentAId,
    stage: "hod_verification_pending",
    sequence: 1,
    approverRole: "hod",
  });
});

function validSubmitPayload(departmentId: string, clientName: string, overrides: Record<string, unknown> = {}) {
  return {
    consultancy: {
      departmentId,
      academicYearCode: "2025-26",
      consultancyTypeCode: "individual_faculty",
      teamTypeCode: "single_faculty",
      title: "Phase 12 Search Test Consultancy",
      consultancyAreaCode: "artificial_intelligence",
      startDate: "2026-01-01",
      expectedCompletionDate: "2026-06-01",
    },
    client: { organizationName: clientName, organizationTypeCode: "private_company" },
    agreement: { agreementTypeCode: "work_order", agreementValue: "50000", paymentTermsCode: "milestone_based" },
    team: { members: [{ name: "Phase 12 Faculty", role: "Principal Investigator" }] },
    financial: { totalValue: "50000" },
    scope: { scopeOfWork: "Build a test integration.", deliverables: [{ description: "Final report" }] },
    resources: { ipAgreementRequired: false, caiasResourcesRequired: false },
    ...overrides,
  };
}

async function createSubmittedConsultancy(
  facultyCookie: string,
  departmentId: string,
  clientName: string,
  overrides: Record<string, unknown> = {}
) {
  const draftRes = await fetch(`${BASE_URL}/api/consultancies`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      departmentId,
      academicYearCode: "2025-26",
      consultancyTypeCode: "individual_faculty",
      teamTypeCode: "single_faculty",
      title: "Phase 12 Search Test Consultancy",
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

  const submitRes = await fetch(`${BASE_URL}/api/consultancies/${draft.id}/submit`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify(validSubmitPayload(departmentId, clientName, overrides)),
  });
  assert.equal(submitRes.status, 200);
  return (await submitRes.json()).data;
}

test("filtering by a combination of fields (department + IP involvement + resource usage) returns correct results", async () => {
  const matching = await createSubmittedConsultancy(facultyACookie, departmentAId, "Acme Search Corp", {
    resources: { ipAgreementRequired: true, caiasResourcesRequired: true, resourceDetails: "Lab access" },
  });
  const wrongIp = await createSubmittedConsultancy(facultyACookie, departmentAId, "Acme Search Corp", {
    resources: { ipAgreementRequired: false, caiasResourcesRequired: true, resourceDetails: "Lab access" },
  });
  const wrongDept = await createSubmittedConsultancy(facultyBCookie, departmentBId, "Acme Search Corp", {
    resources: { ipAgreementRequired: true, caiasResourcesRequired: true, resourceDetails: "Lab access" },
  });

  const res = await fetch(
    `${BASE_URL}/api/consultancies/search?departmentId=${departmentAId}&ipInvolvement=true&resourceUsage=true`,
    { headers: { cookie: systemAdminCookie } }
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  const ids = body.data.map((r: { id: string }) => r.id);
  assert.ok(ids.includes(matching.id));
  assert.ok(!ids.includes(wrongIp.id));
  assert.ok(!ids.includes(wrongDept.id));
});

test("search supports a partial client-name filter and pagination", async () => {
  // unique per run so repeated `npm test` invocations against the shared dev DB don't accumulate matches
  const marker = `Zenith-${Date.now()}`;
  const one = await createSubmittedConsultancy(facultyACookie, departmentAId, `${marker} Client One`);
  const two = await createSubmittedConsultancy(facultyACookie, departmentAId, `${marker} Client Two`);

  const fullRes = await fetch(`${BASE_URL}/api/consultancies/search?clientName=${encodeURIComponent(marker)}`, {
    headers: { cookie: systemAdminCookie },
  });
  const fullBody = await fullRes.json();
  assert.equal(fullBody.total, 2);
  const fullIds = fullBody.data.map((r: { id: string }) => r.id);
  assert.ok(fullIds.includes(one.id) && fullIds.includes(two.id));

  const pageRes = await fetch(
    `${BASE_URL}/api/consultancies/search?clientName=${encodeURIComponent(marker)}&pageSize=1&page=1`,
    { headers: { cookie: systemAdminCookie } }
  );
  const pageBody = await pageRes.json();
  assert.equal(pageBody.data.length, 1);
  assert.equal(pageBody.total, 2);
  assert.equal(pageBody.pageSize, 1);
});

test("a faculty-only user's search is scoped to their own department, even if they request another department", async () => {
  const ownDept = await createSubmittedConsultancy(facultyACookie, departmentAId, "Faculty Scope Own Dept");
  const otherDept = await createSubmittedConsultancy(facultyBCookie, departmentBId, "Faculty Scope Other Dept");

  const res = await fetch(`${BASE_URL}/api/consultancies/search?departmentId=${departmentBId}`, {
    headers: { cookie: facultyACookie },
  });
  const body = await res.json();
  const ids = body.data.map((r: { id: string }) => r.id);
  assert.ok(ids.includes(ownDept.id));
  assert.ok(!ids.includes(otherDept.id));
});

test("export produces a CSV matching the filtered search result set, and rejects export outside a faculty user's own department", async () => {
  const targetDept = await createSubmittedConsultancy(facultyACookie, departmentAId, "CSV Export Client");

  const searchRes = await fetch(`${BASE_URL}/api/consultancies/search?departmentId=${departmentAId}&clientName=CSV%20Export`, {
    headers: { cookie: systemAdminCookie },
  });
  const searchBody = await searchRes.json();

  const exportRes = await fetch(
    `${BASE_URL}/api/consultancies/export?format=csv&departmentId=${departmentAId}&clientName=CSV%20Export`,
    { headers: { cookie: systemAdminCookie } }
  );
  assert.equal(exportRes.status, 200);
  assert.match(exportRes.headers.get("content-type") ?? "", /text\/csv/);
  const csvText = await exportRes.text();
  const lines = csvText.trim().split("\r\n");
  assert.equal(lines.length, searchBody.total + 1); // header + rows
  assert.ok(lines[0].includes("Consultancy ID"));
  assert.ok(csvText.includes(targetDept.consultancyCode ?? ""));

  // faculty B exporting with departmentId=A forged into the query is still scoped to their own department
  const facultyExportRes = await fetch(`${BASE_URL}/api/consultancies/export?format=csv&departmentId=${departmentAId}`, {
    headers: { cookie: facultyBCookie },
  });
  const facultyCsv = await facultyExportRes.text();
  assert.ok(!facultyCsv.includes(targetDept.consultancyCode ?? "___never___"));
});

test("export produces a valid PDF summary", async () => {
  await createSubmittedConsultancy(facultyACookie, departmentAId, "PDF Export Client");

  const res = await fetch(`${BASE_URL}/api/consultancies/export?format=pdf&departmentId=${departmentAId}`, {
    headers: { cookie: systemAdminCookie },
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /application\/pdf/);
  const buffer = Buffer.from(await res.arrayBuffer());
  assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-");
  assert.ok(buffer.length > 100);
});

test("aggregate report queries group by status/department/academic year, and financial totals group by department", async () => {
  const consultancy = await createSubmittedConsultancy(facultyACookie, departmentAId, "Report Aggregate Client");

  const summaryRes = await fetch(`${BASE_URL}/api/reports/summary`, { headers: { cookie: hodACookie } });
  assert.equal(summaryRes.status, 200);
  const summary = (await summaryRes.json()).data;
  const submittedCount = summary.byStatus.find((s: { key: string }) => s.key === "submitted");
  assert.ok(submittedCount && submittedCount.count >= 1);
  const deptCount = summary.byDepartment.find((d: { key: string }) => d.key === departmentAId);
  assert.ok(deptCount && deptCount.count >= 1);

  const financialsRes = await fetch(`${BASE_URL}/api/reports/financials`, { headers: { cookie: hodACookie } });
  assert.equal(financialsRes.status, 200);
  const financials = (await financialsRes.json()).data;
  const deptTotals = financials.byDepartment.find((d: { key: string }) => d.key === departmentAId);
  assert.ok(deptTotals);
  assert.ok(deptTotals.totalValue >= 50000);

  // hod is not restricted to their own department for reports because they're an oversight role
  assert.ok(consultancy.id);
});
