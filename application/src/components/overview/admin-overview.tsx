import Link from "next/link";
import { asc, desc, eq, and } from "drizzle-orm";
import { ClipboardCheck, FileText } from "lucide-react";
import { db } from "@/db";
import { clients, consultancies, departments } from "@/db/schema";
import type { Role } from "@/db/schema/enums";
import { getOverviewStats } from "@/db/queries/overview";
import { getVerificationQueue, type VerificationQueueItem } from "@/db/queries/verification-queue";
import { getCurrentAcademicYear } from "@/db/queries/dashboard";
import { getCurrentAcademicYearCode } from "@/lib/academic-year";
import { FLAGGABLE_FIELDS } from "@/lib/consultancy/flaggable-fields";
import { formatInr, formatInrCompact } from "@/lib/format";
import { PageHeader } from "@/components/shell/page-header";
import { DepartmentSwitcher } from "@/components/shell/department-switcher";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { HorizontalBarChart, type ChartDataItem } from "@/components/reports/reports-charts";
import { VerificationActions } from "@/components/verification/verification-actions";

const APPROVER_ROLES: Role[] = ["hod", "iiic_admin", "competent_authority", "system_admin"];
const QUEUE_PREVIEW = 5;
const RECENT_PREVIEW = 6;
/** Departments shown individually in the bar card; the rest are summed into "Others" (as in the reference screen). */
const TOP_DEPARTMENTS = 4;

const QUEUE_COLUMNS: DataTableColumn<VerificationQueueItem>[] = [
  {
    header: "Consultancy",
    primary: true,
    cell: (r) => (
      <Link href={`/consultancies/${r.id}`} className="hover:underline">
        <span className="flex flex-col">
          <span className="font-medium text-foreground">{r.consultancyCode ?? "—"}</span>
          <span className="text-xs text-muted-foreground">{r.clientOrganizationName ?? r.title}</span>
        </span>
      </Link>
    ),
  },
  { header: "Department", cell: (r) => r.departmentName ?? "—" },
  { header: "Stage", cell: (r) => <StatusBadge status={r.workflowStage} /> },
  {
    header: "Actions",
    className: "text-right",
    cell: (r) => (
      <div className="flex md:justify-end">
        <VerificationActions
          compact
          consultancyId={r.id}
          consultancyLabel={r.consultancyCode ?? r.title}
          flaggableFields={FLAGGABLE_FIELDS}
        />
      </div>
    ),
  },
];

type RecentRow = {
  id: string;
  consultancyCode: string | null;
  title: string;
  status: VerificationQueueItem["status"];
  totalValue: string | null;
  departmentName: string | null;
  clientOrganizationName: string | null;
};

const RECENT_COLUMNS: DataTableColumn<RecentRow>[] = [
  {
    header: "Consultancy",
    primary: true,
    cell: (r) => (
      <Link href={`/consultancies/${r.id}`} className="hover:underline">
        <span className="flex flex-col">
          <span className="font-medium text-foreground">{r.consultancyCode ?? "Draft"}</span>
          <span className="text-xs text-muted-foreground">{r.clientOrganizationName ?? r.title}</span>
        </span>
      </Link>
    ),
  },
  { header: "Department", cell: (r) => r.departmentName ?? "—" },
  { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { header: "Value", cell: (r) => (r.totalValue ? formatInr(Number(r.totalValue)) : "—") },
];

function TileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-lg transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      {children}
    </Link>
  );
}

/**
 * Admin Overview — the reference "Admin / IIIC Office View" screen for every
 * oversight role. `departmentId` comes from the page's `?department=` param
 * (already validated against real departments by the caller).
 */
export async function AdminOverview({ roles, departmentId }: { roles: Role[]; departmentId?: string }) {
  const isApprover = roles.some((r) => APPROVER_ROLES.includes(r));
  const currentYearRow = await getCurrentAcademicYear();
  const academicYear = currentYearRow?.code ?? getCurrentAcademicYearCode();

  const [stats, deptOptions, queue, recent] = await Promise.all([
    getOverviewStats({ departmentId, academicYearCode: academicYear }),
    db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(eq(departments.isActive, true))
      .orderBy(asc(departments.name)),
    isApprover ? getVerificationQueue({ roles }) : Promise.resolve([] as VerificationQueueItem[]),
    isApprover
      ? Promise.resolve([] as RecentRow[])
      : db
          .select({
            id: consultancies.id,
            consultancyCode: consultancies.consultancyCode,
            title: consultancies.title,
            status: consultancies.status,
            totalValue: consultancies.totalValue,
            departmentName: departments.name,
            clientOrganizationName: clients.organizationName,
          })
          .from(consultancies)
          .leftJoin(departments, eq(departments.id, consultancies.departmentId))
          .leftJoin(clients, eq(clients.consultancyId, consultancies.id))
          .where(and(departmentId ? eq(consultancies.departmentId, departmentId) : undefined))
          .orderBy(desc(consultancies.createdAt))
          .limit(RECENT_PREVIEW),
  ]);

  const scopedQueue = departmentId ? queue.filter((q) => q.departmentId === departmentId) : queue;
  const departmentName = deptOptions.find((d) => d.id === departmentId)?.name;
  const deptQuery = departmentId ? `&department=${departmentId}` : "";

  const top = stats.activeByDepartment.slice(0, TOP_DEPARTMENTS);
  const othersCount = stats.activeByDepartment.slice(TOP_DEPARTMENTS).reduce((acc, d) => acc + d.count, 0);
  const deptBars: ChartDataItem[] = [
    ...top.map((d) => ({ label: d.departmentName, value: d.count, color: "bg-primary" })),
    ...(othersCount > 0 ? [{ label: "Others", value: othersCount, color: "bg-primary" }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Admin Overview"
        subtitle={`${departmentName ?? "Institution-wide"} · Academic Year ${academicYear}`}
        action={<DepartmentSwitcher departments={deptOptions} />}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <TileLink href="/verification-queue">
          <StatTile label="Pending Verification" value={stats.pendingVerification} tone="accent" />
        </TileLink>
        <TileLink href={`/consultancies?status=active${deptQuery}`}>
          <StatTile label={departmentId ? "Active in Department" : "Active Institution-wide"} value={stats.active} />
        </TileLink>
        <StatTile label="Overdue Milestones" value={stats.overdueMilestones} tone={stats.overdueMilestones > 0 ? "danger" : "neutral"} />
        <TileLink href={`/consultancies?academicYearCode=${academicYear}${deptQuery}`}>
          <StatTile label={`Total Value ${academicYear}`} value={formatInrCompact(stats.totalValueYtd)} tone="primary" />
        </TileLink>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {isApprover ? (
            <>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">Verification Queue</CardTitle>
                {scopedQueue.length > QUEUE_PREVIEW && (
                  <Link href="/verification-queue" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline md:min-h-0">
                    View all ({scopedQueue.length}) →
                  </Link>
                )}
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={QUEUE_COLUMNS}
                  data={scopedQueue.slice(0, QUEUE_PREVIEW)}
                  keyFor={(r) => r.id}
                  emptyState={
                    <EmptyState
                      icon={ClipboardCheck}
                      title="Nothing awaiting your verification"
                      description={departmentName ? `No ${departmentName} consultancies are at a stage you approve.` : "You're all caught up."}
                    />
                  }
                />
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">Recent Consultancies</CardTitle>
                <Link
                  href={`/consultancies${departmentId ? `?department=${departmentId}` : ""}`}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline md:min-h-0"
                >
                  View all →
                </Link>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={RECENT_COLUMNS}
                  data={recent}
                  keyFor={(r) => r.id}
                  emptyState={<EmptyState icon={FileText} title="No consultancies yet" />}
                />
              </CardContent>
            </>
          )}
        </Card>

        <HorizontalBarChart title="Active Consultancies by Department" data={deptBars} />
      </div>
    </div>
  );
}
