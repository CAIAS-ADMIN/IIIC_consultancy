import { eq, getTableColumns } from "drizzle-orm";
import { db } from "@/db";
import { consultancies, clients } from "@/db/schema";
import { getFinancialSummary } from "@/lib/consultancy/financials";

function groupCount<T>(rows: T[], keyFn: (row: T) => string): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyFn(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => ({ key, count }));
}

/** Aggregate counts by status, department, academic year, client organization type, and consultancy area — Phase 12 task 2. */
export async function getSummaryReport(scopeDepartmentId: string | null | undefined) {
  if (scopeDepartmentId === null) {
    return { byStatus: [], byDepartment: [], byAcademicYear: [], byClientType: [], byCategory: [] };
  }

  const rows = await db
    .select({ ...getTableColumns(consultancies), clientOrganizationTypeCode: clients.organizationTypeCode })
    .from(consultancies)
    .leftJoin(clients, eq(clients.consultancyId, consultancies.id))
    .where(scopeDepartmentId ? eq(consultancies.departmentId, scopeDepartmentId) : undefined);

  return {
    byStatus: groupCount(rows, (r) => r.status),
    byDepartment: groupCount(rows, (r) => r.departmentId),
    byAcademicYear: groupCount(rows, (r) => r.academicYearCode),
    byClientType: groupCount(rows, (r) => r.clientOrganizationTypeCode ?? "unknown"),
    byCategory: groupCount(rows, (r) => r.consultancyAreaCode),
  };
}

type FinancialTotals = { totalValue: number; totalReceived: number; amountPending: number };
type RowWithFinancial = { row: { departmentId: string; academicYearCode: string }; financial: FinancialTotals };

function groupFinancialSum(
  rows: RowWithFinancial[],
  keyFn: (row: RowWithFinancial["row"]) => string
): { key: string; totalValue: number; totalReceived: number; amountPending: number }[] {
  const totals = new Map<string, FinancialTotals>();
  for (const { row, financial } of rows) {
    const key = keyFn(row);
    const current = totals.get(key) ?? { totalValue: 0, totalReceived: 0, amountPending: 0 };
    current.totalValue += financial.totalValue;
    current.totalReceived += financial.totalReceived;
    current.amountPending += financial.amountPending;
    totals.set(key, current);
  }
  return [...totals.entries()].map(([key, t]) => ({ key, ...t }));
}

/** Financial totals (value/received/pending) grouped by department and by academic year — Phase 12 task 2. */
export async function getFinancialsReport(scopeDepartmentId: string | null | undefined) {
  if (scopeDepartmentId === null) {
    return { byDepartment: [], byAcademicYear: [] };
  }

  const rows = await db
    .select()
    .from(consultancies)
    .where(scopeDepartmentId ? eq(consultancies.departmentId, scopeDepartmentId) : undefined);

  const withFinancials = await Promise.all(rows.map(async (row) => ({ row, financial: await getFinancialSummary(row) })));

  return {
    byDepartment: groupFinancialSum(withFinancials, (r) => r.departmentId),
    byAcademicYear: groupFinancialSum(withFinancials, (r) => r.academicYearCode),
  };
}
