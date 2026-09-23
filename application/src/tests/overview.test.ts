import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { and, count, eq, inArray } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { consultancies } from "@/db/schema";
import { getOverviewStats } from "@/db/queries/overview";
import { resolveDepartmentParam } from "@/db/queries/departments-param";

after(async () => {
  await closeDb();
});

test("overview counts match direct queries, institution-wide and per department", async () => {
  const all = await getOverviewStats({ academicYearCode: "2025-26" });
  const [[active], [pending]] = await Promise.all([
    db.select({ n: count() }).from(consultancies).where(eq(consultancies.status, "active")),
    db.select({ n: count() }).from(consultancies).where(inArray(consultancies.status, ["submitted", "under_verification"])),
  ]);
  assert.equal(all.active, active.n);
  assert.equal(all.pendingVerification, pending.n);
  assert.equal(all.activeByDepartment.reduce((acc, d) => acc + d.count, 0), active.n, "per-department bars add up to the tile");

  const busiest = all.activeByDepartment[0];
  if (busiest) {
    const scoped = await getOverviewStats({ academicYearCode: "2025-26", departmentId: busiest.departmentId });
    const [[scopedActive]] = await Promise.all([
      db
        .select({ n: count() })
        .from(consultancies)
        .where(and(eq(consultancies.status, "active"), eq(consultancies.departmentId, busiest.departmentId))),
    ]);
    assert.equal(scoped.active, scopedActive.n);
    assert.deepEqual(scoped.activeByDepartment.map((d) => d.departmentId), [busiest.departmentId]);
  }
});

test("a bad ?department= param falls back to all departments instead of erroring", async () => {
  assert.equal(await resolveDepartmentParam(undefined), undefined);
  assert.equal(await resolveDepartmentParam("not-a-uuid"), undefined);
  assert.equal(await resolveDepartmentParam("11111111-1111-4111-8111-111111111111"), undefined);
});
