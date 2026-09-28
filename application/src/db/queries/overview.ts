import { and, count, desc, eq, inArray, lt, notInArray, sum, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { consultancies, departments, milestones } from "@/db/schema";
import type { ConsultancyStatus } from "@/db/schema/enums";
import { CLOSED_MILESTONE_STATUSES, NOT_OVERDUE_ELIGIBLE_STATUSES } from "./consultancy-derived";
import { presetCondition } from "@/lib/consultancy/search";
import { getFinancialSummaries } from "@/lib/consultancy/financials";

const PENDING_VERIFICATION_STATUSES: ConsultancyStatus[] = ["submitted", "under_verification"];
/** Never signed, so they don't count towards value: a draft has no agreement yet, a rejected one never will. */
const NO_VALUE_STATUSES: ConsultancyStatus[] = ["draft", "rejected"];

export type OverviewStats = {
  pendingVerification: number;
  active: number;
  overdueMilestones: number;
  totalValueYtd: number;
  /** Portal spec §67 CAIAS Admin KPIs. */
  total: number;
  approvalPending: number;
  delayed: number;
  closurePending: number;
  financePending: number;
  amountReceived: number;
  amountPending: number;
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

  const countWhere = (condition: SQL) =>
    db
      .select({ n: count() })
      .from(consultancies)
      .where(and(condition, inDept()))
      .then(([row]) => row.n);

  const [[pending], [active], [overdue], [valueYtd], byDept, total, approvalPending, delayed, closurePending, financePending, valued] = await Promise.all([
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
    countWhere(notInArray(consultancies.status, ["draft"])),
    countWhere(presetCondition("approval_pending")),
    countWhere(eq(consultancies.status, "delayed")),
    countWhere(presetCondition("closure_pending")),
    countWhere(presetCondition("finance_pending")),
    db
      .select({ id: consultancies.id, totalValue: consultancies.totalValue })
      .from(consultancies)
      .where(and(notInArray(consultancies.status, NO_VALUE_STATUSES), inDept())),
  ]);

  // Received / pending across every signed consultancy in scope — the same
  // per-record financial summary the detail pages and reports use.
  const summaries = await getFinancialSummaries(valued);
  let amountReceived = 0;
  let amountPending = 0;
  for (const summary of summaries.values()) {
    amountReceived += summary.totalReceived;
    amountPending += summary.amountPending;
  }

  return {
    pendingVerification: pending.n,
    active: active.n,
    overdueMilestones: overdue.n,
    totalValueYtd: Number(valueYtd.total ?? 0),
    total,
    approvalPending,
    delayed,
    closurePending,
    financePending,
    amountReceived,
    amountPending,
    activeByDepartment: byDept.map((d) => ({ departmentId: d.departmentId, departmentName: d.departmentName, count: d.n })),
  };
}
