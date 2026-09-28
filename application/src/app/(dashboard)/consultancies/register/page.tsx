import Link from "next/link";
import { redirect } from "next/navigation";
import { BookMarked, Download } from "lucide-react";
import { auth } from "@/auth";
import { getRegisterEntries, type RegisterEntry } from "@/db/queries/register";
import { effectiveDepartmentFilter } from "@/lib/consultancy/scope";
import { UrlSearchBox } from "@/components/ui/url-search-box";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { formatInr } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";

/** A main line with a smaller muted line under it — keeps the register to a readable number of columns. */
function Stacked({ main, sub, nowrap }: { main: React.ReactNode; sub?: React.ReactNode; nowrap?: boolean }) {
  return (
    <span className={nowrap ? "flex flex-col whitespace-nowrap" : "flex flex-col"}>
      <span className="text-foreground">{main}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </span>
  );
}

/**
 * The on-screen register groups the spec §39 fields into stacked cells so the
 * table stays readable; the CSV download keeps every field as its own column.
 */
const COLUMNS: DataTableColumn<RegisterEntry>[] = [
  {
    header: "Consultancy",
    primary: true,
    className: "min-w-56",
    cell: (r) => (
      <Link href={`/consultancies/${r.consultancyId}`} className="flex flex-col hover:underline">
        <span className="whitespace-nowrap font-medium text-foreground">{r.consultancyCode ?? "—"}</span>
        <span className="line-clamp-2 text-xs text-muted-foreground">{r.title}</span>
      </Link>
    ),
  },
  { header: "Department / Consultant", className: "min-w-44", cell: (r) => <Stacked main={r.department ?? "—"} sub={r.consultant ?? undefined} /> },
  { header: "Client / Type", className: "min-w-44", cell: (r) => <Stacked main={r.client ?? "—"} sub={r.consultancyType ?? undefined} /> },
  {
    header: "Period",
    cell: (r) => <Stacked nowrap main={r.startDate ?? "—"} sub={`to ${r.completionDate ?? "—"}`} />,
  },
  {
    header: "Value / Received",
    className: "md:text-right",
    cell: (r) => <Stacked nowrap main={formatInr(r.consultancyValue)} sub={`${formatInr(r.amountReceived)} received`} />,
  },
  {
    header: "Agreement / IP",
    cell: (r) => (
      <Stacked
        nowrap
        main={r.agreementReference ?? "—"}
        sub={`${r.ipInvolved ? "IP involved" : "No IP"} · ${r.caiasResourcesUsed ? "Resources used" : "Expertise only"}`}
      />
    ),
  },
  { header: "Closed", className: "whitespace-nowrap", cell: (r) => r.closureDate ?? "—" },
  {
    header: "Feedback / Report",
    className: "min-w-36",
    cell: (r) => <Stacked main={r.clientFeedback ?? "No feedback"} sub={r.finalReportReference ? `Report ${r.finalReportReference}` : "No final report"} />,
  },
  {
    header: "Remarks",
    className: "min-w-56 max-w-xs",
    cell: (r) =>
      r.remarks ? (
        <span className="line-clamp-2" title={r.remarks}>
          {r.remarks}
        </span>
      ) : (
        "—"
      ),
  },
];

const PAGE_SIZE = 25;

/** The Consultancy Services Register (spec §39) — auto-populated from closed records, never a manually maintained table. */
export default async function ConsultancyRegisterPage({ searchParams }: { searchParams: Promise<{ page?: string | string[]; q?: string | string[] }> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const departmentId = effectiveDepartmentFilter(session.user, undefined);
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() || undefined;
  const { total } = await getRegisterEntries({ limit: 0, offset: 0 }, departmentId, query);
  const page = parsePage(params.page, Math.ceil(total / PAGE_SIZE));
  const { entries } = await getRegisterEntries({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }, departmentId, query);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Consultancy Register"
        subtitle="Auto-populated from every completed & closed consultancy."
        action={
          total > 0 && !query ? (
            <Button asChild variant="secondary" className="gap-1.5">
              <a href="/api/consultancies/register?format=csv" download>
                <Download className="h-4 w-4" aria-hidden />
                Download CSV
              </a>
            </Button>
          ) : undefined
        }
      />
      {(total > 0 || query) && (
        <UrlSearchBox id="register-search" label="Search the register" placeholder="Search ID, title, client, consultant or department" />
      )}
      <Card>
        <CardContent className="p-3 md:p-0">
          <DataTable
            columns={COLUMNS}
            data={entries}
            keyFor={(r) => r.consultancyId}
            emptyState={
              query ? (
                <EmptyState
                  className="m-4"
                  icon={BookMarked}
                  title="No matches"
                  description={`No closed consultancy matches “${query}”. Try a different search.`}
                />
              ) : (
                <EmptyState
                  className="m-4"
                  icon={BookMarked}
                  title="No closed consultancies yet"
                  description="Completed consultancies will appear here automatically."
                />
              )
            }
          />
        </CardContent>
      </Card>
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        hrefFor={(p) => {
          const search = new URLSearchParams();
          if (query) search.set("q", query);
          if (p > 1) search.set("page", String(p));
          const qs = search.toString();
          return qs ? `/consultancies/register?${qs}` : "/consultancies/register";
        }}
      />
    </div>
  );
}
