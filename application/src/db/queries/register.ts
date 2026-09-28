import { and, count, desc, eq, ilike, inArray, isNotNull, or } from "drizzle-orm";
import { db } from "@/db";
import { agreements, clientFeedback, clients, closures, consultancies, departments, documents, masterData, users } from "@/db/schema";
import { getFinancialSummaries } from "@/lib/consultancy/financials";
import { FINAL_OUTCOME_OPTIONS } from "@/lib/validation/closure";

/**
 * The CAIAS Consultancy Services Register (portal spec §39), auto-populated
 * from closed consultancy records — never maintained by hand. Shared by the
 * Register page, `GET /api/consultancies/register` and its CSV download.
 * `departmentId` narrows it for a department-scoped caller (HOD / faculty —
 * see `resolveDepartmentScope`).
 */
export async function getRegisterEntries(page?: { limit: number; offset: number }, departmentId?: string, query?: string) {
  const needle = query?.trim();
  const where = and(
    eq(consultancies.status, "completed_closed"),
    departmentId ? eq(consultancies.departmentId, departmentId) : undefined,
    needle
      ? or(
          ilike(consultancies.consultancyCode, `%${needle}%`),
          ilike(consultancies.title, `%${needle}%`),
          ilike(clients.organizationName, `%${needle}%`),
          ilike(users.name, `%${needle}%`),
          ilike(departments.name, `%${needle}%`)
        )
      : undefined
  );
  const [{ total }] = await db
    .select({ total: count() })
    .from(consultancies)
    .leftJoin(departments, eq(departments.id, consultancies.departmentId))
    .leftJoin(users, eq(users.id, consultancies.facultyInChargeId))
    .leftJoin(clients, eq(clients.consultancyId, consultancies.id))
    .where(where);

  const base = db
    .select({
      consultancy: consultancies,
      departmentName: departments.name,
      consultantName: users.name,
      clientName: clients.organizationName,
      agreementReference: agreements.agreementNumber,
    })
    .from(consultancies)
    .leftJoin(departments, eq(departments.id, consultancies.departmentId))
    .leftJoin(users, eq(users.id, consultancies.facultyInChargeId))
    .leftJoin(clients, eq(clients.consultancyId, consultancies.id))
    .leftJoin(agreements, eq(agreements.consultancyId, consultancies.id))
    .where(where)
    .orderBy(desc(consultancies.actualCompletionDate), desc(consultancies.id));
  const rows = page ? await base.limit(page.limit).offset(page.offset) : await base;

  const ids = rows.map((r) => r.consultancy.id);
  const [closureRows, feedbackRows, reportRows, natureRows, summaries] =
    ids.length === 0
      ? [[], [], [], [], new Map()]
      : await Promise.all([
          db.select().from(closures).where(and(inArray(closures.consultancyId, ids), eq(closures.status, "verified"))),
          db.select().from(clientFeedback).where(inArray(clientFeedback.consultancyId, ids)).orderBy(desc(clientFeedback.createdAt)),
          db
            .select({ id: documents.id, consultancyId: documents.consultancyId, version: documents.version })
            .from(documents)
            .where(and(inArray(documents.consultancyId, ids), eq(documents.documentCategory, "Final Report"), isNotNull(documents.id))),
          db.select({ code: masterData.code, label: masterData.label }).from(masterData).where(eq(masterData.category, "nature_of_consultancy")),
          getFinancialSummaries(rows.map((r) => r.consultancy)),
        ]);

  const closureFor = new Map(closureRows.map((c) => [c.consultancyId, c]));
  const reportFor = new Map<string, { id: string; version: number }>();
  for (const d of reportRows) {
    const current = reportFor.get(d.consultancyId);
    if (!current || d.version > current.version) reportFor.set(d.consultancyId, d);
  }
  const natureLabel = new Map(natureRows.map((n) => [n.code, n.label]));

  const entries = rows.map(({ consultancy: c, departmentName, consultantName, clientName, agreementReference }) => {
    const closure = closureFor.get(c.id);
    const feedback = feedbackRows.filter((f) => f.consultancyId === c.id);
    const rated = feedback.map((f) => f.rating).filter((r): r is number => r !== null);
    const report = reportFor.get(c.id);
    const outcome = FINAL_OUTCOME_OPTIONS.find((o) => o.code === closure?.finalOutcome)?.label;
    return {
      consultancyId: c.id,
      consultancyCode: c.consultancyCode,
      academicYear: c.academicYearCode,
      department: departmentName,
      consultant: consultantName,
      client: clientName,
      title: c.title,
      consultancyType: c.natureOfConsultancyCode ? (natureLabel.get(c.natureOfConsultancyCode) ?? c.natureOfConsultancyCode) : null,
      startDate: c.startDate,
      completionDate: c.actualCompletionDate ?? closure?.actualCompletionDate ?? null,
      consultancyValue: Number(c.totalValue ?? 0),
      amountReceived: summaries.get(c.id)?.totalReceived ?? 0,
      status: c.status,
      agreementReference,
      ipInvolved: c.ipExpected === "yes" || c.ipAgreementRequired,
      caiasResourcesUsed: c.caiasResourcesRequired,
      closureDate: closure?.verifiedAt ? closure.verifiedAt.toISOString().slice(0, 10) : null,
      clientFeedback: rated.length > 0 ? `${(rated.reduce((a, b) => a + b, 0) / rated.length).toFixed(1)}/5` : (feedback[0]?.comments ?? null),
      finalReportReference: report ? `${report.id.slice(0, 8).toUpperCase()} (v${report.version})` : null,
      remarks: [outcome, closure?.finalOutcomes].filter(Boolean).join(" — ") || null,
      // Kept for older API consumers.
      finalOutcomes: closure?.finalOutcomes ?? null,
      deliverableCompletionStatus: closure?.deliverableCompletionStatus ?? null,
    };
  });

  return { entries, total };
}

export type RegisterEntry = Awaited<ReturnType<typeof getRegisterEntries>>["entries"][number];

/** Spec §39 register fields, in order, for the CSV download. */
export const REGISTER_CSV_COLUMNS: [keyof RegisterEntry, string][] = [
  ["consultancyCode", "Consultancy ID"],
  ["academicYear", "Academic Year"],
  ["department", "Department"],
  ["consultant", "Consultant"],
  ["client", "Client"],
  ["title", "Consultancy Title"],
  ["consultancyType", "Consultancy Type"],
  ["startDate", "Start Date"],
  ["completionDate", "Completion Date"],
  ["consultancyValue", "Consultancy Value"],
  ["amountReceived", "Amount Received"],
  ["status", "Status"],
  ["agreementReference", "Agreement Reference"],
  ["ipInvolved", "IP Involved"],
  ["caiasResourcesUsed", "CAIAS Resources Used"],
  ["closureDate", "Closure Date"],
  ["clientFeedback", "Client Feedback"],
  ["finalReportReference", "Final Report"],
  ["remarks", "Remarks"],
];
