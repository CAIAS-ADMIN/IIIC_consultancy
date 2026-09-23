import { redirect } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { consultancies, departments, masterData, users } from "@/db/schema";
import { consultancyStatusEnum } from "@/db/schema/enums";
import { PageHeader } from "@/components/shell/page-header";
import { resolveDepartmentScope } from "@/lib/consultancy/scope";
import { getSummaryReport, getFinancialsReport } from "@/lib/reports/aggregate";
import { ReportsHub } from "@/components/reports/reports-hub";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const scope = resolveDepartmentScope({
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    roles: session.user.roles,
    departmentId: session.user.departmentId,
  });

  const [summaryData, financialData, deptRows, facultyRows, labelRows] = await Promise.all([
    getSummaryReport(scope),
    getFinancialsReport(scope),
    db
      .select({ id: departments.id, name: departments.name, code: departments.code })
      .from(departments)
      .orderBy(asc(departments.name)),
    // Only faculty who are actually in charge of something in scope — a
    // filter option that can never match anything is just noise.
    scope === null
      ? Promise.resolve([])
      : db
          .selectDistinct({ id: users.id, name: users.name })
          .from(consultancies)
          .innerJoin(users, eq(users.id, consultancies.facultyInChargeId))
          .where(scope ? eq(consultancies.departmentId, scope) : undefined)
          .orderBy(asc(users.name)),
    db
      .select({ category: masterData.category, code: masterData.code, label: masterData.label })
      .from(masterData)
      .where(inArray(masterData.category, ["consultancy_area", "organization_type"])),
  ]);

  const labelsFor = (category: string) =>
    Object.fromEntries(labelRows.filter((r) => r.category === category).map((r) => [r.code, r.label]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reports & Analytics" subtitle="Consultancy reports, analytics and data exports." />
      <ReportsHub
        summaryData={summaryData}
        financialData={financialData}
        departments={deptRows}
        faculty={facultyRows.map((f) => ({ value: f.id, label: f.name }))}
        statuses={[...consultancyStatusEnum.enumValues]}
        areaLabels={labelsFor("consultancy_area")}
        orgTypeLabels={labelsFor("organization_type")}
        scopedDepartmentId={scope}
      />
    </div>
  );
}
