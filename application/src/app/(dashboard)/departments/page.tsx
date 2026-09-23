import { redirect } from "next/navigation";
import Link from "next/link";
import { asc, count } from "drizzle-orm";
import { Settings } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { departments, consultancies } from "@/db/schema";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { DepartmentManagementHub, type DepartmentRow } from "@/components/admin/department-management-hub";

/** Same roles that get "Departments" in the nav; only system_admin/iiic_admin may change anything (matches the API). */
const VIEW_ROLES = ["hod", "iiic_admin", "system_admin"] as const;

export default async function DepartmentsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }
  const roles = session.user.roles;
  if (!roles.some((r) => (VIEW_ROLES as readonly string[]).includes(r))) {
    redirect("/dashboard");
  }

  const [deptList, consultancyCounts] = await Promise.all([
    db
      .select({ id: departments.id, name: departments.name, code: departments.code, isActive: departments.isActive })
      .from(departments)
      .orderBy(asc(departments.name)),
    db
      .select({ departmentId: consultancies.departmentId, total: count() })
      .from(consultancies)
      .groupBy(consultancies.departmentId),
  ]);

  const countMap = new Map(consultancyCounts.map((c) => [c.departmentId, c.total]));
  const rows: DepartmentRow[] = deptList.map((d) => ({ ...d, consultancyCount: countMap.get(d.id) ?? 0 }));
  const canManage = roles.includes("system_admin") || roles.includes("iiic_admin");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Departments" subtitle="Academic departments participating in consultancy activities." />
        {roles.includes("system_admin") && (
          <Button asChild variant="secondary" className="gap-1.5 self-start">
            <Link href="/master-data">
              <Settings className="h-4 w-4" aria-hidden />
              Master Data
            </Link>
          </Button>
        )}
      </div>

      <DepartmentManagementHub departments={rows} canManage={canManage} />
    </div>
  );
}
