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
import { UrlSearchBox } from "@/components/ui/url-search-box";
import { matchesQuery } from "@/lib/search";
import { Card, CardContent } from "@/components/ui/card";

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

export default async function VerificationQueuePage({ searchParams }: { searchParams: Promise<{ page?: string | string[]; q?: string | string[] }> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }
  if (!session.user.roles.some((r) => APPROVER_ROLES.includes(r))) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() || undefined;
  const allItems = await getVerificationQueue({ roles: session.user.roles, departmentId: session.user.departmentId });
  const items = allItems.filter((i) => matchesQuery(query, i.consultancyCode, i.title, i.clientOrganizationName, i.departmentName));
  const rawPage = params.page;
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const page = parsePage(rawPage, pageCount);
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (target: number) => {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (target > 1) search.set("page", String(target));
    const qs = search.toString();
    return qs ? `/verification-queue?${qs}` : "/verification-queue";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Verification Queue"
        subtitle={
          query
            ? `${items.length} of ${allItems.length} awaiting your review match “${query}”`
            : `${items.length} consultanc${items.length === 1 ? "y" : "ies"} awaiting your review`
        }
      />
      {allItems.length > 0 && (
        <UrlSearchBox id="queue-search" label="Search the verification queue" placeholder="Search ID, title, client or department" />
      )}
      <Card>
        <CardContent className="p-3 md:p-0">
          <DataTable
            columns={COLUMNS}
            data={pageItems}
            keyFor={(r) => r.id}
            emptyState={
              <EmptyState
                icon={ClipboardCheck}
                title={query ? "No matches" : "Nothing to review"}
                description={
                  query
                    ? `Nothing awaiting your review matches “${query}”. Try a different search.`
                    : "You're all caught up — no consultancies are currently awaiting your verification."
                }
                className="m-4"
              />
            }
          />
        </CardContent>
      </Card>
      <Pagination page={page} pageSize={PAGE_SIZE} total={items.length} hrefFor={pageHref} />
    </div>
  );
}
