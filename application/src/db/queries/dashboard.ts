import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { consultancies, clients, departments, masterData } from "@/db/schema";
import type { ConsultancyStatus } from "@/db/schema/enums";

export type FacultyConsultancyRow = {
  id: string;
  consultancyCode: string | null;
  title: string;
  status: ConsultancyStatus;
  totalValue: string | null;
  academicYearCode: string;
  createdAt: Date;
  clientOrganizationName: string | null;
  departmentName: string | null;
};

/** Every consultancy the given faculty member is in charge of, newest first — small enough per-user to compute stats over in JS rather than a separate aggregate query. */
export async function getFacultyConsultancies(facultyId: string): Promise<FacultyConsultancyRow[]> {
  return db
    .select({
      id: consultancies.id,
      consultancyCode: consultancies.consultancyCode,
      title: consultancies.title,
      status: consultancies.status,
      totalValue: consultancies.totalValue,
      academicYearCode: consultancies.academicYearCode,
      createdAt: consultancies.createdAt,
      clientOrganizationName: clients.organizationName,
      departmentName: departments.name,
    })
    .from(consultancies)
    .leftJoin(clients, eq(clients.consultancyId, consultancies.id))
    .leftJoin(departments, eq(departments.id, consultancies.departmentId))
    .where(eq(consultancies.facultyInChargeId, facultyId))
    .orderBy(desc(consultancies.createdAt));
}

/**
 * The `academic_year` master-data row flagged `metadata.current: true` by
 * `seed-master-data.ts`. Not derived from sort order — the seeded range
 * deliberately includes a year ahead of "today" (so a wizard can plan next
 * year's consultancies), which rules out "highest sort order = current".
 * Returns `null` if the category hasn't been seeded yet, in which case
 * callers fall back to `getCurrentAcademicYearCode`'s date-derived value.
 */
export async function getCurrentAcademicYear() {
  const rows = await db.query.masterData.findMany({
    where: and(eq(masterData.category, "academic_year"), eq(masterData.isActive, true)),
  });
  return rows.find((row) => (row.metadata as { current?: boolean } | null)?.current === true) ?? null;
}
