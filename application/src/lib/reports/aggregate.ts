import { and, eq, getTableColumns, inArray } from "drizzle-orm";
import { db } from "@/db";
import { consultancies, clients, clientFeedback, closures, paymentTransactions, users } from "@/db/schema";
import { getFinancialSummaries } from "@/lib/consultancy/financials";

function groupCount<T>(rows: T[], keyFn: (row: T) => string): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyFn(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => ({ key, count }));
}

const EMPTY_SUMMARY = {
  byStatus: [],
  byDepartment: [],
  byAcademicYear: [],
  byClientType: [],
  byCategory: [],
  byFaculty: [],
  byConsultancyCategory: [],
  byNature: [],
  byOutcome: [],
  satisfaction: { byRating: [], average: null, responses: 0 },
  highlights: { completed: 0, ipGenerated: 0, resourceIntensive: 0, multidisciplinary: 0 },
};

/**
 * Operational + outcome reports (portal spec §61): counts by status,
 * department, academic year, faculty, client type, consultancy area,
 * consultancy category and nature; final outcomes of closed records; client
 * satisfaction; and the IP / resource-intensive / multidisciplinary counts.
 * Drafts are not consultancies yet, so outcome figures leave them out.
 */
export async function getSummaryReport(scopeDepartmentId: string | null | undefined) {
  if (scopeDepartmentId === null) {
    return EMPTY_SUMMARY;
  }

  const rows = await db
    .select({
      ...getTableColumns(consultancies),
      clientOrganizationTypeCode: clients.organizationTypeCode,
      facultyName: users.name,
    })
    .from(consultancies)
    .leftJoin(clients, eq(clients.consultancyId, consultancies.id))
    .leftJoin(users, eq(users.id, consultancies.facultyInChargeId))
    .where(scopeDepartmentId ? eq(consultancies.departmentId, scopeDepartmentId) : undefined);

  const ids = rows.map((r) => r.id);
  const [verifiedClosures, feedbackRows] =
    ids.length === 0
      ? [[], []]
      : await Promise.all([
          db
            .select({ consultancyId: closures.consultancyId, finalOutcome: closures.finalOutcome })
            .from(closures)
            .where(and(eq(closures.status, "verified"), inArray(closures.consultancyId, ids))),
          db.select({ rating: clientFeedback.rating }).from(clientFeedback).where(inArray(clientFeedback.consultancyId, ids)),
        ]);

  const registered = rows.filter((r) => r.status !== "draft");
  const ratings = feedbackRows.map((f) => f.rating).filter((r): r is number => r !== null);

  return {
    byStatus: groupCount(rows, (r) => r.status),
    byDepartment: groupCount(rows, (r) => r.departmentId),
    byAcademicYear: groupCount(rows, (r) => r.academicYearCode),
    byClientType: groupCount(rows, (r) => r.clientOrganizationTypeCode ?? "unknown"),
    byCategory: groupCount(rows, (r) => r.consultancyAreaCode),
    byFaculty: groupCount(registered, (r) => r.facultyName ?? "Unknown"),
    byConsultancyCategory: groupCount(registered, (r) => r.consultancyCategoryCode ?? "unspecified"),
    byNature: groupCount(registered, (r) => r.natureOfConsultancyCode ?? "unspecified"),
    byOutcome: groupCount(verifiedClosures, (c) => c.finalOutcome ?? "unspecified"),
    satisfaction: {
      byRating: groupCount(ratings, (r) => String(r)),
      average: ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
      responses: ratings.length,
    },
    highlights: {
      completed: rows.filter((r) => r.status === "completed_closed").length,
      ipGenerated: registered.filter((r) => r.ipExpected === "yes" || r.ipAgreementRequired).length,
      resourceIntensive: registered.filter(
        (r) =>
          r.caiasResourcesRequired ||
          r.consultancyCategoryCode === "infrastructure_intensive" ||
          r.consultancyCategoryCode === "expertise_plus_infrastructure"
      ).length,
      multidisciplinary: registered.filter(
        (r) => r.consultancyCategoryCode === "multidisciplinary" || (r.consultancyDomainCodes?.length ?? 0) > 1
      ).length,
    },
  };
}

type FinancialTotals = { totalValue: number; totalReceived: number; amountPending: number; tds: number };
type RowWithFinancial = { row: { departmentId: string; academicYearCode: string }; financial: FinancialTotals };

function groupFinancialSum(
  rows: RowWithFinancial[],
  keyFn: (row: RowWithFinancial["row"]) => string
): { key: string; totalValue: number; totalReceived: number; amountPending: number; tds: number }[] {
  const totals = new Map<string, FinancialTotals>();
  for (const { row, financial } of rows) {
    const key = keyFn(row);
    const current = totals.get(key) ?? { totalValue: 0, totalReceived: 0, amountPending: 0, tds: 0 };
    current.totalValue += financial.totalValue;
    current.totalReceived += financial.totalReceived;
    current.amountPending += financial.amountPending;
    current.tds += financial.tds;
    totals.set(key, current);
  }
  return [...totals.entries()].map(([key, t]) => ({ key, ...t }));
}

/**
 * Financial totals (value / received / pending / TDS) grouped by department
 * and academic year, plus the overdue-payment count (portal spec §61).
 */
export async function getFinancialsReport(scopeDepartmentId: string | null | undefined) {
  if (scopeDepartmentId === null) {
    return { byDepartment: [], byAcademicYear: [], overduePayments: 0 };
  }

  const rows = await db
    .select()
    .from(consultancies)
    .where(scopeDepartmentId ? eq(consultancies.departmentId, scopeDepartmentId) : undefined);

  const [summaries, tdsRows] = await Promise.all([
    getFinancialSummaries(rows),
    rows.length === 0
      ? Promise.resolve([] as { consultancyId: string; tds: string | null }[])
      : db
          .select({ consultancyId: paymentTransactions.consultancyId, tds: paymentTransactions.tdsDeducted })
          .from(paymentTransactions)
          .where(inArray(paymentTransactions.consultancyId, rows.map((r) => r.id))),
  ]);
  const tdsByConsultancy = new Map<string, number>();
  for (const t of tdsRows) tdsByConsultancy.set(t.consultancyId, (tdsByConsultancy.get(t.consultancyId) ?? 0) + Number(t.tds ?? 0));

  const withFinancials = rows.map((row) => ({ row, financial: { ...summaries.get(row.id)!, tds: tdsByConsultancy.get(row.id) ?? 0 } }));

  return {
    byDepartment: groupFinancialSum(withFinancials, (r) => r.departmentId),
    byAcademicYear: groupFinancialSum(withFinancials, (r) => r.academicYearCode),
    overduePayments: [...summaries.values()].filter((s) => s.paymentStatus === "overdue").length,
  };
}
