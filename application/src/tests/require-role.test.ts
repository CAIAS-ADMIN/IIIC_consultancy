import { test, mock } from "node:test";
import assert from "node:assert/strict";

let currentSession: unknown = null;

mock.module("@/auth", {
  namedExports: {
    auth: async () => currentSession,
    handlers: {},
    signIn: async () => {},
    signOut: async () => {},
  },
});

async function loadRequireRole() {
  return import("@/lib/auth/requireRole");
}

test("requireRole rejects an unauthenticated request", async () => {
  currentSession = null;
  const { requireRole, UnauthorizedError } = await loadRequireRole();
  await assert.rejects(() => requireRole("finance"), UnauthorizedError);
});

test("requireRole rejects a faculty-only user calling a finance-gated action", async () => {
  currentSession = {
    user: { id: "u1", name: "Faculty User", email: "f@x.com", roles: ["faculty"], departmentId: null },
  };
  const { requireRole, ForbiddenError } = await loadRequireRole();
  await assert.rejects(() => requireRole("finance"), ForbiddenError);
});

test("requireRole allows a user holding the required role", async () => {
  currentSession = {
    user: { id: "u2", name: "Finance User", email: "fin@x.com", roles: ["finance"], departmentId: null },
  };
  const { requireRole } = await loadRequireRole();
  const user = await requireRole("finance");
  assert.equal(user.id, "u2");
  assert.deepEqual(user.roles, ["finance"]);
});

test("requireRole allows a user holding any one of several accepted roles", async () => {
  currentSession = {
    user: { id: "u3", name: "Admin User", email: "a@x.com", roles: ["system_admin"], departmentId: null },
  };
  const { requireRole } = await loadRequireRole();
  const user = await requireRole("finance", "system_admin");
  assert.equal(user.id, "u3");
});
