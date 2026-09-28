import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  consultancyDepartments,
  consultancyTeamMembers,
  deliverables,
  departments,
  milestones,
  paymentSchedules,
  users,
} from "@/db/schema";
import { getAgreementByConsultancyId, getClientByConsultancyId, getConsultancyById } from "./consultancies";
import { listMasterData } from "./master-data";
import { listDocumentsForConsultancy } from "./documents";

export type MasterLabels = Record<string, { code: string; label: string }[]>;

/**
 * Everything captured at registration for one consultancy, with the names
 * behind its ids resolved — the single source for the detail page's
 * registration sections and the printable Registration Record (PDF 1).
 */
export async function getRegistrationRecord(id: string) {
  const consultancy = await getConsultancyById(id);
  if (!consultancy) return null;

  const [client, agreement, team, deliverableRows, milestoneRows, scheduleRows, involvedRows, masterRows, documentRows] =
    await Promise.all([
      getClientByConsultancyId(id),
      getAgreementByConsultancyId(id),
      db.query.consultancyTeamMembers.findMany({ where: eq(consultancyTeamMembers.consultancyId, id) }),
      db.query.deliverables.findMany({ where: eq(deliverables.consultancyId, id), orderBy: [asc(deliverables.dueDate)] }),
      db.query.milestones.findMany({ where: eq(milestones.consultancyId, id), orderBy: [asc(milestones.plannedDate)] }),
      db.query.paymentSchedules.findMany({ where: eq(paymentSchedules.consultancyId, id), orderBy: [asc(paymentSchedules.plannedDate)] }),
      db.query.consultancyDepartments.findMany({ where: eq(consultancyDepartments.consultancyId, id) }),
      listMasterData(),
      listDocumentsForConsultancy(id),
    ]);

  const departmentIds = [consultancy.departmentId, ...involvedRows.map((r) => r.departmentId)];
  const userIds = [consultancy.departmentCoordinatorId, consultancy.declarationAcceptedBy, consultancy.facultyInChargeId].filter(
    (v): v is string => Boolean(v)
  );
  const [departmentRows, userRows] = await Promise.all([
    db.select({ id: departments.id, name: departments.name }).from(departments).where(inArray(departments.id, departmentIds)),
    userIds.length > 0
      ? db
          .select({ id: users.id, name: users.name, employeeId: users.employeeId, email: users.email, phone: users.phone })
          .from(users)
          .where(inArray(users.id, userIds))
      : Promise.resolve([]),
  ]);
  const departmentName = (deptId: string) => departmentRows.find((d) => d.id === deptId)?.name ?? "—";
  const userById = (userId: string | null) => (userId ? (userRows.find((u) => u.id === userId) ?? null) : null);

  const masterData: MasterLabels = {};
  for (const row of masterRows) (masterData[row.category] ??= []).push({ code: row.code, label: row.label });

  // Latest available version per category — the document checklist shows what's on file, not every revision.
  const latestDocuments = new Map<string, (typeof documentRows)[number]>();
  for (const doc of documentRows) {
    const current = latestDocuments.get(doc.documentCategory);
    if (!current || doc.version > current.version) latestDocuments.set(doc.documentCategory, doc);
  }

  return {
    consultancy,
    client,
    agreement,
    team,
    deliverables: deliverableRows,
    milestones: milestoneRows,
    paymentSchedule: scheduleRows,
    departmentName: departmentName(consultancy.departmentId),
    departmentsInvolved: involvedRows.map((r) => departmentName(r.departmentId)),
    coordinator: userById(consultancy.departmentCoordinatorId),
    facultyInCharge: userById(consultancy.facultyInChargeId),
    declarant: userById(consultancy.declarationAcceptedBy),
    documents: [...latestDocuments.values()],
    masterData,
  };
}

export type RegistrationRecord = NonNullable<Awaited<ReturnType<typeof getRegistrationRecord>>>;
