import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSessionCookie } from "./helpers/session";
import { upsertTestUser, upsertTestDepartment, BASE_URL } from "./helpers/fixtures";
import { closeDb, db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";

let facultyCookie: string;
let otherFacultyCookie: string;
let adminCookie: string;
let departmentId: string;
let consultancyId: string;

after(async () => {
  await closeDb();
});

before(async () => {
  const department = await upsertTestDepartment({ code: "DOCSTESTDEPT", name: "Documents Test Department" });
  departmentId = department.id;

  const faculty = await upsertTestUser({
    keycloakSub: "test-faculty-documents",
    name: "Documents Test Faculty",
    email: "test.faculty.documents@caias.in",
    roles: ["faculty"],
  });
  facultyCookie = await createTestSessionCookie({ userId: faculty.id, roles: ["faculty"] });

  const otherFaculty = await upsertTestUser({
    keycloakSub: "test-other-faculty-documents",
    name: "Other Documents Test Faculty",
    email: "test.other.faculty.documents@caias.in",
    roles: ["faculty"],
  });
  otherFacultyCookie = await createTestSessionCookie({ userId: otherFaculty.id, roles: ["faculty"] });

  const admin = await upsertTestUser({
    keycloakSub: "test-admin-documents",
    name: "Documents Test Admin",
    email: "test.admin.documents@caias.in",
    roles: ["system_admin"],
  });
  adminCookie = await createTestSessionCookie({ userId: admin.id, roles: ["system_admin"] });

  const draftRes = await fetch(`${BASE_URL}/api/consultancies`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({
      departmentId,
      academicYearCode: "2025-26",
      consultancyTypeCode: "individual_faculty",
      teamTypeCode: "single_faculty",
      title: "Documents Integration Test Consultancy",
      consultancyAreaCode: "artificial_intelligence",
    }),
  });
  assert.equal(draftRes.status, 201);
  consultancyId = (await draftRes.json()).data.id;
});

async function presign(cookie: string, overrides: Record<string, unknown> = {}) {
  return fetch(`${BASE_URL}/api/documents/presign`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({
      consultancyId,
      documentCategory: "Signed Agreement",
      originalFileName: "agreement.pdf",
      contentType: "application/pdf",
      fileSizeBytes: 1024,
      ...overrides,
    }),
  });
}

async function confirm(cookie: string, body: Record<string, unknown>) {
  return fetch(`${BASE_URL}/api/documents/confirm`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("presign is rejected for a user with no relation to the consultancy", async () => {
  const res = await presign(otherFacultyCookie);
  assert.equal(res.status, 403);
});

test("upload -> confirm -> download round-trip works for a real file, and re-upload creates version 2", async () => {
  const fileBytes = Buffer.from("this is the signed agreement content");

  // --- version 1 ---
  const presignRes = await presign(facultyCookie);
  assert.equal(presignRes.status, 200);
  const { uploadUrl, objectKey } = (await presignRes.json()).data;

  const putRes = await fetch(uploadUrl, { method: "PUT", body: fileBytes, headers: { "content-type": "application/pdf" } });
  assert.equal(putRes.status, 200);

  const confirmRes = await confirm(facultyCookie, {
    consultancyId,
    objectKey,
    documentCategory: "Signed Agreement",
    originalFileName: "agreement.pdf",
    confidentialityLevel: "internal",
  });
  assert.equal(confirmRes.status, 201);
  const doc1 = (await confirmRes.json()).data;
  assert.equal(doc1.version, 1);
  assert.equal(doc1.status, "available");

  const downloadRes = await fetch(`${BASE_URL}/api/documents/${doc1.id}/download`, {
    headers: { cookie: facultyCookie },
  });
  assert.equal(downloadRes.status, 200);
  const { downloadUrl } = (await downloadRes.json()).data;
  const fileRes = await fetch(downloadUrl);
  assert.equal(fileRes.status, 200);
  assert.equal(await fileRes.text(), fileBytes.toString());

  // --- version 2: re-uploading the same category never overwrites, both remain retrievable ---
  const presignRes2 = await presign(facultyCookie, { originalFileName: "agreement-v2.pdf" });
  const { uploadUrl: uploadUrl2, objectKey: objectKey2 } = (await presignRes2.json()).data;
  assert.notEqual(objectKey2, objectKey);

  const fileBytes2 = Buffer.from("this is the revised signed agreement content");
  const putRes2 = await fetch(uploadUrl2, { method: "PUT", body: fileBytes2, headers: { "content-type": "application/pdf" } });
  assert.equal(putRes2.status, 200);

  const confirmRes2 = await confirm(facultyCookie, {
    consultancyId,
    objectKey: objectKey2,
    documentCategory: "Signed Agreement",
    originalFileName: "agreement-v2.pdf",
    confidentialityLevel: "internal",
  });
  assert.equal(confirmRes2.status, 201);
  const doc2 = (await confirmRes2.json()).data;
  assert.equal(doc2.version, 2);

  // version 1 object is untouched and still downloadable
  const stillThereRes = await fetch(`${BASE_URL}/api/documents/${doc1.id}/download`, {
    headers: { cookie: facultyCookie },
  });
  assert.equal(stillThereRes.status, 200);
  const { downloadUrl: downloadUrl1Again } = (await stillThereRes.json()).data;
  const fileResAgain = await fetch(downloadUrl1Again);
  assert.equal(await fileResAgain.text(), fileBytes.toString());

  const rows = await db.select().from(documents).where(eq(documents.consultancyId, consultancyId));
  const versions = rows.filter((r) => r.documentCategory === "Signed Agreement").map((r) => r.version).sort();
  assert.deepEqual(versions, [1, 2]);
});

test("confirm rejects an objectKey that doesn't belong to the consultancy", async () => {
  const res = await confirm(facultyCookie, {
    consultancyId,
    objectKey: "consultancies/not-this-one/signed-agreement/whatever.txt",
    documentCategory: "Signed Agreement",
    originalFileName: "agreement.txt",
  });
  assert.equal(res.status, 400);
});

test("a restricted document is not downloadable by an unrelated faculty user, but is by system_admin", async () => {
  const presignRes = await presign(facultyCookie, { documentCategory: "Client Feedback" });
  const { uploadUrl, objectKey } = (await presignRes.json()).data;
  await fetch(uploadUrl, { method: "PUT", body: "restricted content" });

  const confirmRes = await confirm(facultyCookie, {
    consultancyId,
    objectKey,
    documentCategory: "Client Feedback",
    originalFileName: "feedback.txt",
    confidentialityLevel: "restricted",
  });
  const doc = (await confirmRes.json()).data;

  const deniedRes = await fetch(`${BASE_URL}/api/documents/${doc.id}/download`, {
    headers: { cookie: otherFacultyCookie },
  });
  assert.equal(deniedRes.status, 403);

  const ownerRes = await fetch(`${BASE_URL}/api/documents/${doc.id}/download`, {
    headers: { cookie: facultyCookie },
  });
  assert.equal(ownerRes.status, 200);

  const adminRes = await fetch(`${BASE_URL}/api/documents/${doc.id}/download`, {
    headers: { cookie: adminCookie },
  });
  assert.equal(adminRes.status, 200);
});

test("GET /api/consultancies/:id/documents lists every version of every category, newest version first, with a per-row viewerCanDownload flag", async () => {
  // v1 + v2 of Signed Agreement already exist on this consultancy from the earlier test.
  const restrictedPresign = await presign(facultyCookie, { documentCategory: "Client Feedback" });
  const { uploadUrl, objectKey } = (await restrictedPresign.json()).data;
  await fetch(uploadUrl, { method: "PUT", body: "list-route restricted content" });
  await confirm(facultyCookie, {
    consultancyId,
    objectKey,
    documentCategory: "Client Feedback",
    originalFileName: "feedback-for-list.txt",
    confidentialityLevel: "restricted",
  });

  const ownerRes = await fetch(`${BASE_URL}/api/consultancies/${consultancyId}/documents`, {
    headers: { cookie: facultyCookie },
  });
  assert.equal(ownerRes.status, 200);
  const ownerBody = await ownerRes.json();
  const signedAgreementRows = ownerBody.data.filter((r: { documentCategory: string }) => r.documentCategory === "Signed Agreement");
  assert.equal(signedAgreementRows.length, 2);
  assert.deepEqual(signedAgreementRows.map((r: { version: number }) => r.version), [2, 1]); // newest first
  assert.ok(signedAgreementRows.every((r: { uploadedByName: string }) => r.uploadedByName === "Documents Test Faculty"));
  assert.ok(ownerBody.data.every((r: { viewerCanDownload: boolean }) => r.viewerCanDownload === true));

  // An unrelated faculty user (not on the record, not in its department) can't list the record's documents at all (portal spec §64)…
  const outsiderRes = await fetch(`${BASE_URL}/api/consultancies/${consultancyId}/documents`, {
    headers: { cookie: otherFacultyCookie },
  });
  assert.equal(outsiderRes.status, 404);

  // …while an oversight role that can open the record sees every row, flagged unable to download the restricted one.
  const hod = await upsertTestUser({ keycloakSub: "test-hod-documents", name: "Documents Test HOD", email: "test.hod.documents@caias.in", roles: ["hod"] });
  const hodCookie = await createTestSessionCookie({ userId: hod.id, roles: ["hod"], departmentId });
  const otherRes = await fetch(`${BASE_URL}/api/consultancies/${consultancyId}/documents`, {
    headers: { cookie: hodCookie },
  });
  const otherBody = await otherRes.json();
  assert.equal(otherBody.data.length, ownerBody.data.length);
  const restrictedRow = otherBody.data.find((r: { documentCategory: string }) => r.documentCategory === "Client Feedback");
  assert.equal(restrictedRow.viewerCanDownload, false);
  const publicRow = otherBody.data.find((r: { documentCategory: string }) => r.documentCategory === "Signed Agreement");
  assert.equal(publicRow.viewerCanDownload, true);

  // category filter
  const filteredRes = await fetch(`${BASE_URL}/api/consultancies/${consultancyId}/documents?category=${encodeURIComponent("Client Feedback")}`, {
    headers: { cookie: facultyCookie },
  });
  const filteredBody = await filteredRes.json();
  assert.ok(filteredBody.data.every((r: { documentCategory: string }) => r.documentCategory === "Client Feedback"));
});

test("download of an unknown document id is 404", async () => {
  const res = await fetch(`${BASE_URL}/api/documents/00000000-0000-0000-0000-000000000000/download`, {
    headers: { cookie: facultyCookie },
  });
  assert.equal(res.status, 404);
});
