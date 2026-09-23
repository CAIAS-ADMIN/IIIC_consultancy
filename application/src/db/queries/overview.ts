import { and, count, desc, eq, inArray, lt, notInArray, sum, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { consultancies, departments, milestones } from "@/db/schema";
import type { ConsultancyStatus } from "@/db/schema/enums";
import { CLOSED_MILESTONE_STATUSES, NOT_OVERDUE_ELIGIBLE_STATUSES } from "./consultancy-derived";

const PENDING_VERIFICATION_STATUSES: ConsultancyStatus[] = ["submitted", "under_verification"];
/** Never signed, so they don't count towards value: a draft has no agreement yet, a rejected one never will. */
const NO_VALUE_STATUSES: ConsultancyStatus[] = ["draft", "rejected"];

export type OverviewStats = {
  pendingVerification: number;
  active: number;
  overdueMilestones: number;
  totalValueYtd: number;
  activeByDepartment: { departmentId: string; departmentName: string; count: number }[];
};

/**
 * Admin Overview numbers, optionally narrowed to one department. "Overdue
 * milestones" uses exactly the same rule as a consultancy's own derived
 * fields (`getConsultancyDerivedFields`) — past planned date, not closed,
 * parent consultancy not paused/terminal — so the tile total always equals
 * the sum of what each detail page shows.
 */
export async function getOverviewStats(input: { departmentId?: string; academicYearCode: string }): Promise<OverviewStats> {
  const inDept = (): SQL | undefined => (input.departmentId ? eq(consultancies.departmentId, input.departmentId) : undefined);
  const today = new Date().toISOString().slice(0, 10);

  const [[pending], [active], [overdue], [valueYtd], byDept] = await Promise.all([
    db
      .select({ n: count() })
      .from(consultancies)
      .where(and(inArray(consultancies.status, PENDING_VERIFICATION_STATUSES), inDept())),
    db
      .select({ n: count() })
      .from(consultancies)
      .where(and(eq(consultancies.status, "active"), inDept())),
    db
      .select({ n: count() })
      .from(milestones)
      .innerJoin(consultancies, eq(consultancies.id, milestones.consultancyId))
      .where(
        and(
          lt(milestones.plannedDate, today),
          notInArray(milestones.status, [...CLOSED_MILESTONE_STATUSES]),
          notInArray(consultancies.status, NOT_OVERDUE_ELIGIBLE_STATUSES as ConsultancyStatus[]),
          inDept()
        )
      ),
    db
      .select({ total: sum(consultancies.totalValue) })
      .from(consultancies)
      .where(
        and(
          eq(consultancies.academicYearCode, input.academicYearCode),
          notInArray(consultancies.status, NO_VALUE_STATUSES),
          inDept()
        )
      ),
    db
      .select({ departmentId: consultancies.departmentId, departmentName: departments.name, n: count() })
      .from(consultancies)
      .innerJoin(departments, eq(departments.id, consultancies.departmentId))
      .where(and(eq(consultancies.status, "active"), inDept()))
      .groupBy(consultancies.departmentId, departments.name)
      .orderBy(desc(count())),
  ]);

  return {
    pendingVerification: pending.n,
    active: active.n,
    overdueMilestones: overdue.n,
    totalValueYtd: Number(valueYtd.total ?? 0),
    activeByDepartment: byDept.map((d) => ({ departmentId: d.departmentId, departmentName: d.departmentName, count: d.n })),
  };
}
