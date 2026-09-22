import { and, count, desc, eq, gte, ilike, lte, getTableColumns, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { consultancies, clients } from "@/db/schema";
import { consultancyStatusEnum, paymentStatusEnum, type ConsultancyStatus, type PaymentStatus } from "@/db/schema/enums";
import { getFinancialSummary } from "./financials";

export type ConsultancySearchFilters = {
  consultancyCode?: string;
  departmentId?: string;
  facultyInChargeId?: string;
  clientName?: string;
  status?: ConsultancyStatus;
  academicYearCode?: string;
  createdFrom?: string;
  createdTo?: string;
  ipInvolvement?: boolean;
  resourceUsage?: boolean;
  /** Derived, not a SQL column — applied after fetching the SQL-matching set. */
  paymentStatus?: PaymentStatus;
};

const MAX_PAGE_SIZE = 100;

export function parseSearchFilters(searchParams: URLSearchParams): ConsultancySearchFilters {
  const get = (key: string) => searchParams.get(key) ?? undefined;
  const getBool = (key: string) => {
    const raw = get(key);
    return raw === undefined ? undefined : raw === "true";
  };
  return {
    consultancyCode: get("consultancyCode"),
    departmentId: get("departmentId"),
    facultyInChargeId: get("facultyInChargeId"),
    clientName: get("clientName"),
    status: get("status") as ConsultancyStatus | undefined,
    academicYearCode: get("academicYearCode"),
    createdFrom: get("createdFrom"),
    createdTo: get("createdTo"),
    ipInvolvement: getBool("ipInvolvement"),
    resourceUsage: getBool("resourceUsage"),
    paymentStatus: get("paymentStatus") as PaymentStatus | undefined,
  };
}

/** Returns an error message for an invalid enum-valued filter, or null if the filters check out. */
export function validateSearchFilters(filters: ConsultancySearchFilters): string | null {
  if (filters.status && !(consultancyStatusEnum.enumValues as readonly string[]).includes(filters.status)) {
    return `Invalid status '${filters.status}'`;
  }
  if (filters.paymentStatus && !(paymentStatusEnum.enumValues as readonly string[]).includes(filters.paymentStatus)) {
    return `Invalid paymentStatus '${filters.paymentStatus}'`;
  }
  return null;
}

function buildSqlConditions(filters: ConsultancySearchFilters, scopeDepartmentId: string | undefined): SQL[] {
  const conditions: SQL[] = [];
  const departmentFilter = scopeDepartmentId ?? filters.departmentId;
  if (departmentFilter) conditions.push(eq(consultancies.departmentId, departmentFilter));
  if (filters.consultancyCode) conditions.push(ilike(consultancies.consultancyCode, `%${filters.consultancyCode}%`));
  if (filters.facultyInChargeId) conditions.push(eq(consultancies.facultyInChargeId, filters.facultyInChargeId));
  if (filters.status) conditions.push(eq(consultancies.status, filters.status));
  if (filters.academicYearCode) conditions.push(eq(consultancies.academicYearCode, filters.academicYearCode));
  if (filters.createdFrom) conditions.push(gte(consultancies.createdAt, new Date(filters.createdFrom)));
  if (filters.createdTo) conditions.push(lte(consultancies.createdAt, new Date(filters.createdTo)));
  if (filters.ipInvolvement !== undefined) conditions.push(eq(consultancies.ipAgreementRequired, filters.ipInvolvement));
  if (filters.resourceUsage !== undefined) conditions.push(eq(consultancies.caiasResourcesRequired, filters.resourceUsage));
  if (filters.clientName) conditions.push(ilike(clients.organizationName, `%${filters.clientName}%`));
  return conditions;
}

/**
 * Runs the search (SQL-level filters + optional department scope), then —
 * only if `paymentStatus` was asked for, since it's derived, not a column —
 * computes it per row and filters/paginates in JS. Otherwise pagination
 * happens at the SQL level, which is the common, cheap path.
 */
export async function searchConsultancies(
  filters: ConsultancySearchFilters,
  scopeDepartmentId: string | undefined,
  pagination: { page: number; pageSize: number }
) {
  const pageSize = Math.min(Math.max(pagination.pageSize, 1), MAX_PAGE_SIZE);
  const page = Math.max(pagination.page, 1);
  const conditions = buildSqlConditions(filters, scopeDepartmentId);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const baseQuery = db
    .select({ ...getTableColumns(consultancies), clientOrganizationName: clients.organizationName })
    .from(consultancies)
    .leftJoin(clients, eq(clients.consultancyId, consultancies.id))
    .where(where)
    .orderBy(desc(consultancies.createdAt));

  if (!filters.paymentStatus) {
    const [rows, [{ total }]] = await Promise.all([
      baseQuery.limit(pageSize).offset((page - 1) * pageSize),
      db
        .select({ total: count() })
        .from(consultancies)
        .leftJoin(clients, eq(clients.consultancyId, consultancies.id))
        .where(where),
    ]);
    return { rows, total, page, pageSize };
  }

  const allMatching = await baseQuery;
  const withPaymentStatus = await Promise.all(
    allMatching.map(async (row) => ({ row, paymentStatus: (await getFinancialSummary(row)).paymentStatus }))
  );
  const filtered = withPaymentStatus.filter((r) => r.paymentStatus === filters.paymentStatus).map((r) => r.row);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  return { rows: paged, total: filtered.length, page, pageSize };
}

export const EXPORT_MAX_ROWS = 5000;

/** Same filters as `searchConsultancies`, but the full matching set (up to a hard cap) — for CSV/PDF export, not interactive paging. */
export async function searchAllForExport(filters: ConsultancySearchFilters, scopeDepartmentId: string | undefined) {
  const conditions = buildSqlConditions(filters, scopeDepartmentId);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({ ...getTableColumns(consultancies), clientOrganizationName: clients.organizationName })
    .from(consultancies)
    .leftJoin(clients, eq(clients.consultancyId, consultancies.id))
    .where(where)
    .orderBy(desc(consultancies.createdAt))
    .limit(EXPORT_MAX_ROWS);

  if (!filters.paymentStatus) {
    return rows;
  }

  const withPaymentStatus = await Promise.all(
    rows.map(async (row) => ({ row, paymentStatus: (await getFinancialSummary(row)).paymentStatus }))
  );
  return withPaymentStatus.filter((r) => r.paymentStatus === filters.paymentStatus).map((r) => r.row);
}
