import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { createTestSessionCookie } from "./helpers/session";
import { upsertTestUser, BASE_URL } from "./helpers/fixtures";
import { closeDb, db } from "@/db";
import { departments } from "@/db/schema";
import { getNavItems } from "@/components/shell/nav-config";

let facultyCookie: string;
let adminCookie: string;
const runId = Date.now().toString(36).toUpperCase();

after(async () => {
  await closeDb();
});

before(async () => {
  const faculty = await upsertTestUser({
    keycloakSub: "test-faculty-departments",
    name: "Test Faculty",
    email: "test.faculty.departments@caias.in",
    roles: ["faculty"],
  });
  const admin = await upsertTestUser({
    keycloakSub: "test-iiic-admin-departments",
    name: "Test IIIC Admin",
    email: "test.iiic-admin.departments@caias.in",
    roles: ["iiic_admin"],
  });
  facultyCookie = await createTestSessionCookie({ userId: faculty.id, roles: ["faculty"] });
  adminCookie = await createTestSessionCookie({ userId: admin.id, roles: ["iiic_admin"] });
});

async function call(method: string, path: string, cookie: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
}

async function createDepartment(suffix: string) {
  const res = await call("POST", "/api/departments", adminCookie, { name: `Test Dept ${suffix}`, code: `t${runId}${suffix}` });
  assert.equal(res.status, 201);
  return res.json.data as { id: string; code: string };
}

test("POST /api/departments is forbidden for faculty and validates input for admins", async () => {
  assert.equal((await call("POST", "/api/departments", facultyCookie, { name: "X", code: "X" })).status, 403);
  assert.equal((await call("POST", "/api/departments", adminCookie, { code: `T${runId}NONAME` })).status, 400);
});

test("department codes are upper-cased and unique on both create and rename", async () => {
  const a = await createDepartment("A");
  const b = await createDepartment("B");
  assert.equal(a.code, `T${runId}A`);

  const dupCreate = await call("POST", "/api/departments", adminCookie, { name: "Dup", code: a.code.toLowerCase() });
  assert.equal(dupCreate.status, 409);

  const dupRename = await call("PATCH", `/api/departments/${b.id}`, adminCookie, { code: a.code });
  assert.equal(dupRename.status, 409);

  for (const d of [a, b]) assert.equal((await call("DELETE", `/api/departments/${d.id}`, adminCookie)).status, 200);
});

test("GET /api/departments (used by pickers) excludes deactivated departments", async () => {
  const d = await createDepartment("C");
  const listed = async () =>
    ((await call("GET", "/api/departments", facultyCookie)).json.data as { id: string }[]).some((row) => row.id === d.id);

  assert.equal(await listed(), true);
  assert.equal((await call("PATCH", `/api/departments/${d.id}`, adminCookie, { isActive: false })).status, 200);
  assert.equal(await listed(), false);

  await call("DELETE", `/api/departments/${d.id}`, adminCookie);
});

test("DELETE refuses a department that is still referenced, leaving it and its references intact", async () => {
  const d = await createDepartment("D");
  const member = {
    keycloakSub: `test-dept-member-${runId}`,
    name: "Dept Member",
    email: `test.dept-member-${runId}@caias.in`,
    roles: ["faculty" as const],
  };
  await upsertTestUser({ ...member, departmentId: d.id });

  const blocked = await call("DELETE", `/api/departments/${d.id}`, adminCookie);
  assert.equal(blocked.status, 409);
  assert.equal(blocked.json.canDeactivate, true);
  assert.match(blocked.json.error, /1 user/);
  assert.ok(await db.query.departments.findFirst({ where: eq(departments.id, d.id) }));

  // Once nothing refers to it, it can be deleted.
  await upsertTestUser({ ...member, departmentId: null });
  assert.equal((await call("DELETE", `/api/departments/${d.id}`, adminCookie)).status, 200);
  assert.equal(await db.query.departments.findFirst({ where: eq(departments.id, d.id) }), undefined);
});

test("Master Data appears in the nav for system_admin only", () => {
  const hasMasterData = (roles: Parameters<typeof getNavItems>[0]) => getNavItems(roles).some((i) => i.href === "/master-data");
  assert.equal(hasMasterData(["system_admin"]), true);
  assert.equal(hasMasterData(["system_admin", "faculty"]), true);
  for (const role of ["hod", "iiic_admin", "competent_authority", "finance", "audit_readonly", "faculty"] as const) {
    assert.equal(hasMasterData([role]), false, `${role} must not see Master Data`);
  }
});
