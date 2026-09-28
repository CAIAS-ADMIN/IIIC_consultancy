import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { approvalStageConfigs, departments } from "@/db/schema";
import { listMasterData } from "@/db/queries/master-data";
import { PageHeader } from "@/components/shell/page-header";
import { ApprovalSettingsHub } from "@/components/admin/approval-settings-hub";
import { APPROVAL_CONFIG_ROLES } from "@/lib/validation/approval-config";

export default async function ApprovalSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const roles = session.user.roles;
  const canManage = roles.some((r) => (APPROVAL_CONFIG_ROLES as readonly string[]).includes(r));
  if (!canManage && !roles.includes("audit_readonly")) redirect("/dashboard");

  const [configs, departmentRows, masterRows] = await Promise.all([
    db.select().from(approvalStageConfigs).orderBy(asc(approvalStageConfigs.sequence)),
    db.select({ code: departments.id, label: departments.name }).from(departments).where(eq(departments.isActive, true)).orderBy(asc(departments.name)),
    listMasterData(),
  ]);
  const options = (category: string) => masterRows.filter((m) => m.category === category && m.isActive).map((m) => ({ code: m.code, label: m.label }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Approval Settings"
        subtitle="Which verification and approval stages a registration goes through — HOD, CAIAS and Competent Authority — and when."
      />
      <ApprovalSettingsHub
        configs={configs}
        departments={departmentRows}
        areas={options("consultancy_area")}
        categories={options("consultancy_category")}
        canManage={canManage}
      />
    </div>
  );
}
