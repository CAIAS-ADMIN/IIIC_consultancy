import { and, count, eq, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  agreements,
  approvalStageConfigs,
  clients,
  consultancies,
  consultancyIdSequences,
  consultancyTeamMembers,
  documents,
  masterData,
} from "@/db/schema";

export async function listMasterData(category?: string) {
  if (category) {
    return db.query.masterData.findMany({
      where: eq(masterData.category, category),
      orderBy: (row, { asc }) => [asc(row.sortOrder), asc(row.label)],
    });
  }
  return db.query.masterData.findMany({
    orderBy: (row, { asc }) => [asc(row.category), asc(row.sortOrder), asc(row.label)],
  });
}

export async function getMasterDataById(id: string) {
  return db.query.masterData.findFirst({ where: eq(masterData.id, id) });
}

export async function getMasterDataByCode(category: string, code: string) {
  return db.query.masterData.findFirst({
    where: and(eq(masterData.category, category), eq(masterData.code, code)),
  });
}

type Usage = { where: string; count: number };

/**
 * Where a master-data value is in use, per place that stores it. Records keep
 * the value's code (documents keep the document type's label), so deleting a
 * value that's in use would leave those records showing a bare code — such a
 * value can only be deactivated.
 */
export async function getMasterDataUsage(item: { category: string; code: string; label: string }): Promise<Usage[]> {
  const { code, label } = item;
  const countWhere = async (where: string, table: PgTable, condition: SQL) => {
    const [{ n }] = await db.select({ n: count() }).from(table).where(condition);
    return { where, count: n };
  };
  const inList = (column: AnyPgColumn) => sql`${column} ? ${code}`;

  const checks: Record<string, () => Promise<Usage>[]> = {
    academic_year: () => [
      countWhere("consultancies", consultancies, eq(consultancies.academicYearCode, code)),
      countWhere("consultancy ID numbering", consultancyIdSequences, eq(consultancyIdSequences.academicYearCode, code)),
    ],
    consultancy_type: () => [countWhere("consultancies", consultancies, eq(consultancies.consultancyTypeCode, code))],
    consultancy_area: () => [
      countWhere("consultancies", consultancies, eq(consultancies.consultancyAreaCode, code)),
      countWhere("approval settings", approvalStageConfigs, eq(approvalStageConfigs.consultancyAreaCode, code)),
    ],
    team_type: () => [countWhere("consultancies", consultancies, eq(consultancies.teamTypeCode, code))],
    nature_of_consultancy: () => [countWhere("consultancies", consultancies, eq(consultancies.natureOfConsultancyCode, code))],
    consultancy_category: () => [countWhere("consultancies", consultancies, eq(consultancies.consultancyCategoryCode, code))],
    consultancy_domain: () => [countWhere("consultancies", consultancies, inList(consultancies.consultancyDomainCodes))],
    ip_type: () => [countWhere("consultancies", consultancies, inList(consultancies.ipTypeCodes))],
    resource_type: () => [countWhere("consultancies", consultancies, inList(consultancies.resourceTypeCodes))],
    reporting_frequency: () => [countWhere("consultancies", consultancies, eq(consultancies.reportingFrequency, code))],
    // Stored as "INR" by default, "inr" when picked from the dropdown.
    currency: () => [countWhere("consultancies", consultancies, sql`lower(${consultancies.currencyCode}) = lower(${code})`)],
    organization_type: () => [countWhere("clients", clients, eq(clients.organizationTypeCode, code))],
    agreement_type: () => [countWhere("agreements", agreements, eq(agreements.agreementTypeCode, code))],
    payment_terms: () => [countWhere("agreements", agreements, eq(agreements.paymentTermsCode, code))],
    payment_mode: () => [countWhere("agreements", agreements, eq(agreements.paymentModeCode, code))],
    team_role: () => [countWhere("team members", consultancyTeamMembers, eq(consultancyTeamMembers.role, code))],
    document_type: () => [countWhere("documents", documents, or(eq(documents.documentCategory, label), eq(documents.documentCategory, code))!)],
  };

  const usages = await Promise.all(checks[item.category]?.() ?? []);
  return usages.filter((u) => u.count > 0);
}
