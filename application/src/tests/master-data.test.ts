import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSessionCookie } from "./helpers/session";
import { upsertTestUser, BASE_URL } from "./helpers/fixtures";
import { closeDb } from "@/db";

let facultyCookie: string;
let adminCookie: string;

after(async () => {
  await closeDb();
});

before(async () => {
  const faculty = await upsertTestUser({
    keycloakSub: "test-faculty-master-data",
    name: "Test Faculty",
    email: "test.faculty.master-data@caias.in",
    roles: ["faculty"],
  });
  const admin = await upsertTestUser({
    keycloakSub: "test-admin-master-data",
    name: "Test Admin",
    email: "test.admin.master-data@caias.in",
    roles: ["system_admin"],
  });

  facultyCookie = await createTestSessionCookie({ userId: faculty.id, roles: ["faculty"] });
  adminCookie = await createTestSessionCookie({ userId: admin.id, roles: ["system_admin"] });
});

test("GET /api/master-data requires an authenticated session", async () => {
  const res = await fetch(`${BASE_URL}/api/master-data`);
  assert.equal(res.status, 401);
});

test("GET /api/master-data returns seeded rows for any authenticated role", async () => {
  const res = await fetch(`${BASE_URL}/api/master-data`, {
    headers: { cookie: facultyCookie },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.data));
});

test("POST /api/master-data is rejected for a non-admin role", async () => {
  const res = await fetch(`${BASE_URL}/api/master-data`, {
    method: "POST",
    headers: { cookie: facultyCookie, "content-type": "application/json" },
    body: JSON.stringify({ category: "test_category", code: "X", label: "X" }),
  });
  assert.equal(res.status, 403);
});

test("POST /api/master-data succeeds for system_admin and writes exactly one audit event with old/new values", async () => {
  const uniqueCode = `TEST_${Date.now()}`;
  const res = await fetch(`${BASE_URL}/api/master-data`, {
    method: "POST",
    headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ category: "test_category", code: uniqueCode, label: "Original Label" }),
  });
  assert.equal(res.status, 201);
  const created = (await res.json()).data;
  assert.equal(created.label, "Original Label");

  const { db } = await import("@/db");
  const { auditEvents } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");

  const createEvents = await db.query.auditEvents.findMany({
    where: and(eq(auditEvents.entityType, "master_data"), eq(auditEvents.entityId, created.id)),
  });
  assert.equal(createEvents.length, 1);
  assert.equal(createEvents[0].action, "created");
  assert.equal(createEvents[0].oldValue, null);

  const patchRes = await fetch(`${BASE_URL}/api/master-data/${created.id}`, {
    method: "PATCH",
    headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ label: "Updated Label" }),
  });
  assert.equal(patchRes.status, 200);

  const allEvents = await db.query.auditEvents.findMany({
    where: and(eq(auditEvents.entityType, "master_data"), eq(auditEvents.entityId, created.id)),
  });
  assert.equal(allEvents.length, 2);
  const updateEvent = allEvents.find((e) => e.action === "updated");
  assert.ok(updateEvent);
  assert.equal((updateEvent!.oldValue as { label: string }).label, "Original Label");
  assert.equal((updateEvent!.newValue as { label: string }).label, "Updated Label");
});

test("DELETE /api/master-data/:id removes an unused value (system_admin only) but refuses one that's in use", async () => {
  const code = `DEL_${Date.now()}`;
  const created = await fetch(`${BASE_URL}/api/master-data`, {
    method: "POST",
    headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ category: "test_category", code, label: "Added by mistake" }),
  });
  const { id } = (await created.json()).data;

  assert.equal((await fetch(`${BASE_URL}/api/master-data/${id}`, { method: "DELETE", headers: { cookie: facultyCookie } })).status, 403);
  assert.equal((await fetch(`${BASE_URL}/api/master-data/${id}`, { method: "DELETE", headers: { cookie: adminCookie } })).status, 200);
  const list = (await (await fetch(`${BASE_URL}/api/master-data?category=test_category`, { headers: { cookie: adminCookie } })).json()).data;
  assert.ok(!list.some((row: { id: string }) => row.id === id));

  // Academic year 2025-26 is used by the suite's consultancies — it can only be deactivated.
  const years = (await (await fetch(`${BASE_URL}/api/master-data?category=academic_year`, { headers: { cookie: adminCookie } })).json()).data;
  const inUse = years.find((row: { code: string }) => row.code === "2025-26");
  assert.ok(inUse);
  const refused = await fetch(`${BASE_URL}/api/master-data/${inUse.id}`, { method: "DELETE", headers: { cookie: adminCookie } });
  assert.equal(refused.status, 409);
  assert.match((await refused.json()).error, /in use/);
});
