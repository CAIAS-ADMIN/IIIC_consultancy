import Link from "next/link";
import { FileText } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isOversightRole } from "@/components/shell/nav-config";
import { AdminOverview } from "@/components/overview/admin-overview";
import { resolveDepartmentParam } from "@/db/queries/departments-param";
import { canViewAllDepartments, effectiveDepartmentFilter } from "@/lib/consultancy/scope";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFacultyConsultancies, getCurrentAcademicYear, type FacultyConsultancyRow } from "@/db/queries/dashboard";
import { formatInr, formatInrCompact } from "@/lib/format";
import { getCurrentAcademicYearCode } from "@/lib/academic-year";
import type { ConsultancyStatus } from "@/db/schema/enums";

const PENDING_STATUSES: ConsultancyStatus[] = ["submitted", "under_verification", "clarification_required"];
const RECENT_LIMIT = 6;

const COLUMNS: DataTableColumn<FacultyConsultancyRow>[] = [
  {
    header: "Consultancy ID",
    primary: true,
    cell: (r) => (
      <Link href={`/consultancies/${r.id}`} className="font-medium text-foreground hover:underline">
        {r.consultancyCode ?? "Draft"}
      </Link>
    ),
  },
  { header: "Client", cell: (r) => r.clientOrganizationName ?? "—" },
  { header: "Department", cell: (r) => r.departmentName ?? "—" },
  { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { header: "Value", cell: (r) => (r.totalValue ? formatInr(Number(r.totalValue)) : "—") },
  {
    header: "",
    className: "text-right",
    cell: (r) => (
      <Link href={`/consultancies/${r.id}`} className="text-sm font-medium text-primary hover:underline">
        View →
      </Link>
    ),
  },
];

async function FacultyDashboard({ facultyId }: { facultyId: string }) {
  const [rows, currentAcademicYearRow] = await Promise.all([
    getFacultyConsultancies(facultyId),
    getCurrentAcademicYear(),
  ]);
  const currentAcademicYear = currentAcademicYearRow?.code ?? getCurrentAcademicYearCode();

  const newConsultancyAction = (
    <Button asChild>
      <Link href="/consultancies/new">+ New Consultancy</Link>
    </Button>
  );

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Consultancy Dashboard" subtitle={`Academic Year ${currentAcademicYear}`} />
        <EmptyState
          icon={FileText}
          title="No consultancies yet"
          description="Once you create your first consultancy, it will show up here."
          action={newConsultancyAction}
          className="mt-4"
        />
      </div>
    );
  }

  const active = rows.filter((r) => r.status === "active").length;
  const pendingVerification = rows.filter((r) => PENDING_STATUSES.includes(r.status)).length;
  const completedThisYear = rows.filter(
    (r) => r.status === "completed_closed" && r.academicYearCode === currentAcademicYear
  ).length;
  const count = (status: ConsultancyStatus) => rows.filter((r) => r.status === status).length;
  const today = new Date().toISOString().slice(0, 10);
  // Same definitions as the `closure_due` / `pending_actions` list presets the tiles link to.
  const closureDue = rows.filter(
    (r) => (r.status === "active" || r.status === "delayed") && r.currentCompletionDate !== null && r.currentCompletionDate <= today
  ).length;
  const pendingActions = count("draft") + count("clarification_required") + closureDue;
  const totalValue = rows
    .filter((r) => r.status !== "draft")
    .reduce((sum, r) => sum + Number(r.totalValue ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Consultancy Dashboard"
        subtitle={`Academic Year ${currentAcademicYear}`}
        action={newConsultancyAction}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Active" value={active} href="/consultancies?status=active" />
        <StatTile label="Pending Verification" value={pendingVerification} tone="accent" href="/consultancies?preset=pending_verification" />
        <StatTile label="Completed This Year" value={completedThisYear} href="/consultancies?status=completed_closed" />
        <StatTile label="Total Value" value={formatInrCompact(totalValue)} tone="primary" />
      </div>

      {/* Portal spec §67 faculty KPIs — each drills down to the matching list. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <StatTile size="sm" label="Draft" value={count("draft")} href="/consultancies?status=draft" />
        <StatTile size="sm" label="Submitted" value={count("submitted")} href="/consultancies?status=submitted" />
        <StatTile size="sm" label="Active" value={active} href="/consultancies?status=active" />
        <StatTile size="sm" label="Delayed" value={count("delayed")} tone={count("delayed") > 0 ? "danger" : "neutral"} href="/consultancies?status=delayed" />
        <StatTile size="sm" label="Closure Due" value={closureDue} tone={closureDue > 0 ? "accent" : "neutral"} href="/consultancies?preset=closure_due" />
        <StatTile size="sm" label="Closed" value={count("completed_closed")} href="/consultancies?status=completed_closed" />
        <StatTile size="sm" label="Pending Actions" value={pendingActions} tone={pendingActions > 0 ? "accent" : "neutral"} href="/consultancies?preset=pending_actions" />
      </div>

      <nav aria-label="Quick links" className="flex flex-wrap gap-2">
        {[
          ["My Consultancy Records", "/consultancies"],
          ["Pending Actions", "/consultancies?preset=pending_actions"],
          ["Progress Updates", "/consultancies?status=active"],
          ["Closure", "/consultancies?preset=closure_due"],
          ["Documents", "/documents"],
          ["Download Records", "/reports"],
        ].map(([label, href]) => (
          <Button key={label} asChild variant="secondary" size="sm">
            <Link href={href}>{label}</Link>
          </Button>
        ))}
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>Recent Consultancies</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={COLUMNS} data={rows.slice(0, RECENT_LIMIT)} keyFor={(r) => r.id} />
        </CardContent>
      </Card>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ department?: string | string[] }> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  if (isOversightRole(session.user.roles)) {
    const { department } = await searchParams;
    const departmentId = effectiveDepartmentFilter(session.user, await resolveDepartmentParam(department));
    return (
      <AdminOverview
        roles={session.user.roles}
        departmentId={departmentId}
        userDepartmentId={session.user.departmentId}
        departmentLocked={!canViewAllDepartments(session.user)}
      />
    );
  }

  return <FacultyDashboard facultyId={session.user.id} />;
}
