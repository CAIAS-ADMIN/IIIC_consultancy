import { redirect } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { departments, users } from "@/db/schema";
import { listMasterData } from "@/db/queries/master-data";
import { getConsultancyById, getClientByConsultancyId, getAgreementByConsultancyId } from "@/db/queries/consultancies";
import { consultancyTeamMembers, deliverables, consultancyDepartments, milestones, paymentSchedules } from "@/db/schema";
import { getCurrentAcademicYear } from "@/db/queries/dashboard";
import { getCurrentAcademicYearCode } from "@/lib/academic-year";
import { wizardStateFromDraft } from "@/lib/wizard/resume";
import { canEditDraft } from "@/lib/consultancy/access";
import { canChooseFacultyInCharge } from "@/lib/consultancy/faculty-in-charge";
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

  const [departmentRows, masterDataRows, currentAcademicYear, staffRows, me] = await Promise.all([
    db.query.departments.findMany({
      where: eq(departments.isActive, true),
      orderBy: [asc(departments.name)],
      columns: { id: true, name: true },
    }),
    listMasterData(),
    getCurrentAcademicYear(),
    // Faculty picker (admins), coordinator dropdown + "Responsible Person" suggestions (Screen 3 / 9).
    db.query.users.findMany({
      orderBy: [asc(users.name)],
      columns: { id: true, name: true, departmentId: true, employeeId: true, email: true, phone: true, roles: true },
    }),
    db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
  ]);
  const myDepartment = departmentRows.find((d) => d.id === me?.departmentId);
  // An admin fills the form on a faculty member's behalf — the employee is picked
  // on step 1, never defaulted to the admin's own details.
  const onBehalf = canChooseFacultyInCharge(session.user.roles);

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
    const authedUser = { ...session.user, name: session.user.name ?? null, email: session.user.email ?? null };
    if (consultancy && consultancy.status === "draft" && canEditDraft(authedUser, consultancy)) {
      const [client, agreement, teamMembers, deliverableRows, departmentsInvolvedRows, milestoneRows, scheduleRows] =
        await Promise.all([
          getClientByConsultancyId(draftIdParam),
          getAgreementByConsultancyId(draftIdParam),
          db.query.consultancyTeamMembers.findMany({ where: eq(consultancyTeamMembers.consultancyId, draftIdParam) }),
          db.query.deliverables.findMany({ where: eq(deliverables.consultancyId, draftIdParam) }),
          db.query.consultancyDepartments.findMany({ where: eq(consultancyDepartments.consultancyId, draftIdParam) }),
          db.query.milestones.findMany({ where: eq(milestones.consultancyId, draftIdParam) }),
          db.query.paymentSchedules.findMany({ where: eq(paymentSchedules.consultancyId, draftIdParam) }),
        ]);
      initialDraftId = draftIdParam;
      initialState = wizardStateFromDraft({
        consultancy,
        client,
        agreement,
        teamMembers,
        deliverables: deliverableRows,
        milestones: milestoneRows,
        paymentSchedule: scheduleRows,
        departmentsInvolved: departmentsInvolvedRows.map((r) => r.departmentId),
      });
    }
    // An invalid/inaccessible/non-draft id is silently ignored — the wizard just starts fresh.
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={initialDraftId ? "Resume Consultancy Draft" : "New Consultancy"}
        subtitle={
          onBehalf
            ? "Registering on a faculty member's behalf — select the employee on step 1 and their details fill in automatically. You can save a draft at any point."
            : "Complete every step to register a new consultancy. You can save a draft at any point."
        }
      />
      <ConsultancyWizard
        onBehalf={onBehalf}
        principal={{
          id: me?.id ?? session.user.id,
          name: me?.name ?? session.user.name ?? "",
          employeeId: me?.employeeId ?? "",
          email: me?.email ?? session.user.email ?? "",
          phone: me?.phone ?? "",
          departmentId: myDepartment?.id ?? "",
          departmentName: myDepartment?.name ?? "",
        }}
        staff={staffRows}
        departments={departmentRows}
        masterData={masterData}
        defaultAcademicYearCode={defaultAcademicYearCode}
        initialDraftId={initialDraftId}
        initialState={initialState}
      />
    </div>
  );
}
