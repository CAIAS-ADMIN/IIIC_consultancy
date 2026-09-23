import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getVerificationQueue } from "@/db/queries/verification-queue";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination, parsePage } from "@/components/ui/pagination";
import type { VerificationQueueItem } from "@/db/queries/verification-queue";

const APPROVER_ROLES = ["hod", "iiic_admin", "competent_authority", "system_admin"];
const PAGE_SIZE = 25;

const COLUMNS: DataTableColumn<VerificationQueueItem>[] = [
  {
    header: "Consultancy ID",
    primary: true,
    cell: (r) => (
      <Link href={`/consultancies/${r.id}`} className="font-medium text-foreground hover:underline">
        {r.consultancyCode ?? "—"}
      </Link>
    ),
  },
  { header: "Department", cell: (r) => r.departmentName ?? "—" },
  { header: "Client", cell: (r) => r.clientOrganizationName ?? "—" },
  { header: "Stage", cell: (r) => <StatusBadge status={r.workflowStage} /> },
  {
    header: "",
    className: "text-right",
    cell: (r) => (
      <Link href={`/consultancies/${r.id}`} className="text-sm font-medium text-primary hover:underline">
        Review →
      </Link>
    ),
  },
];

export default async function VerificationQueuePage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }
  if (!session.user.roles.some((r) => APPROVER_ROLES.includes(r))) {
    redirect("/dashboard");
  }

  const items = await getVerificationQueue({ roles: session.user.roles });
  const rawPage = (await searchParams).page;
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const page = parsePage(rawPage, pageCount);
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (target: number) => (target > 1 ? `/verification-queue?page=${target}` : "/verification-queue");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Verification Queue"
        subtitle={`${items.length} consultanc${items.length === 1 ? "y" : "ies"} awaiting your review`}
      />
      <DataTable
        columns={COLUMNS}
        data={pageItems}
        keyFor={(r) => r.id}
        emptyState={
          <EmptyState
            icon={ClipboardCheck}
            title="Nothing to review"
            description="You're all caught up — no consultancies are currently awaiting your verification."
          />
        }
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={items.length} hrefFor={pageHref} />
    </div>
  );
}
