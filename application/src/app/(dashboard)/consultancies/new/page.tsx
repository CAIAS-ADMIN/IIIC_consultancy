import { redirect } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { listMasterData } from "@/db/queries/master-data";
import { getConsultancyById, getClientByConsultancyId, getAgreementByConsultancyId } from "@/db/queries/consultancies";
import { consultancyTeamMembers, deliverables, consultancyDepartments } from "@/db/schema";
import { getCurrentAcademicYear } from "@/db/queries/dashboard";
import { getCurrentAcademicYearCode } from "@/lib/academic-year";
import { wizardStateFromDraft } from "@/lib/wizard/resume";
import { ConsultancyWizard } from "@/components/wizard/consultancy-wizard";
import { PageHeader } from "@/components/shell/page-header";
import type { MasterDataMap } from "@/components/wizard/wizard-props";

const ALLOWED_ROLES = ["faculty", "hod", "iiic_admin", "system_admin"];

export default async function NewConsultancyPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }
  if (!session.user.roles.some((r) => ALLOWED_ROLES.includes(r))) {
    redirect("/dashboard");
  }

  const { draft: draftIdParam } = await searchParams;

  const [departmentRows, masterDataRows, currentAcademicYear] = await Promise.all([
    db.query.departments.findMany({
      where: eq(departments.isActive, true),
      orderBy: [asc(departments.name)],
      columns: { id: true, name: true },
    }),
    listMasterData(),
    getCurrentAcademicYear(),
  ]);

  const masterData: MasterDataMap = {};
  for (const row of masterDataRows) {
    if (!row.isActive) continue;
    (masterData[row.category] ??= []).push({ code: row.code, label: row.label });
  }

  const defaultAcademicYearCode = currentAcademicYear?.code ?? getCurrentAcademicYearCode();

  let initialDraftId: string | null = null;
  let initialState = null;

  if (draftIdParam) {
    const consultancy = await getConsultancyById(draftIdParam);
    const isOwner =
      consultancy &&
      (consultancy.createdBy === session.user.id || consultancy.facultyInChargeId === session.user.id);
    const isElevated = session.user.roles.some((r) => ["hod", "iiic_admin", "system_admin"].includes(r));
    if (consultancy && consultancy.status === "draft" && (isOwner || isElevated)) {
      const [client, agreement, teamMembers, deliverableRows, departmentsInvolvedRows] = await Promise.all([
        getClientByConsultancyId(draftIdParam),
        getAgreementByConsultancyId(draftIdParam),
        db.query.consultancyTeamMembers.findMany({ where: eq(consultancyTeamMembers.consultancyId, draftIdParam) }),
        db.query.deliverables.findMany({ where: eq(deliverables.consultancyId, draftIdParam) }),
        db.query.consultancyDepartments.findMany({ where: eq(consultancyDepartments.consultancyId, draftIdParam) }),
      ]);
      initialDraftId = draftIdParam;
      initialState = wizardStateFromDraft({
        consultancy,
        client,
        agreement,
        teamMembers,
        deliverables: deliverableRows,
        departmentsInvolved: departmentsInvolvedRows.map((r) => r.departmentId),
      });
    }
    // An invalid/inaccessible/non-draft id is silently ignored — the wizard just starts fresh.
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={initialDraftId ? "Resume Consultancy Draft" : "New Consultancy"}
        subtitle="Complete all four steps to register a new consultancy."
      />
      <ConsultancyWizard
        facultyName={session.user.name ?? ""}
        departments={departmentRows}
        masterData={masterData}
        defaultAcademicYearCode={defaultAcademicYearCode}
        initialDraftId={initialDraftId}
        initialState={initialState}
      />
    </div>
  );
}
