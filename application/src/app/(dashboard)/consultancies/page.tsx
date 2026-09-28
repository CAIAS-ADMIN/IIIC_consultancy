import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, desc, eq, and } from "drizzle-orm";
import { FileText, SearchX } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { departments, masterData } from "@/db/schema";
import { consultancyStatusEnum, type ConsultancyStatus, type Role } from "@/db/schema/enums";
import { searchConsultancies, type ConsultancySearchFilters } from "@/lib/consultancy/search";
import { resolveDepartmentParam } from "@/db/queries/departments-param";
import { canViewAllDepartments, effectiveDepartmentFilter } from "@/lib/consultancy/scope";
import { isOversightRole } from "@/components/shell/nav-config";
import { PageHeader } from "@/components/shell/page-header";
import { ConsultancyListFilters } from "@/components/consultancy/consultancy-list-filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { formatInr } from "@/lib/format";
import { Pagination } from "@/components/ui/pagination";
import { SEARCH_PRESETS, isSearchPreset } from "@/lib/consultancy/search-presets";

const PAGE_SIZE = 20;
/** Roles the backend lets create a consultancy (same set that gets "New Consultancy" in the nav). */
const CREATOR_ROLES: Role[] = ["faculty", "hod", "iiic_admin", "system_admin"];

type SearchParams = { q?: string; status?: string; academicYearCode?: string; department?: string; page?: string; preset?: string; archived?: string };
type Row = Awaited<ReturnType<typeof searchConsultancies>>["rows"][number];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * "All Consultancies" for view-all oversight roles (IIIC admin, finance, …);
 * "Department Consultancies" for an HOD, pinned to their own department;
 * "My Consultancies" (only the ones they're in charge of) for faculty. Every filter lives in the URL and is
 * applied server-side through the same `searchConsultancies` the search API
 * and exports use, so this list can never disagree with them.
 */
export default async function ConsultanciesPage({ searchParams }: { searchParams: Promise<Record<keyof SearchParams, string | string[] | undefined>> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const roles = session.user.roles;
  const oversight = isOversightRole(roles);
  const raw = await searchParams;
  const q = first(raw.q)?.trim() || undefined;
  const statusParam = first(raw.status);
  const status = (consultancyStatusEnum.enumValues as readonly string[]).includes(statusParam ?? "")
    ? (statusParam as ConsultancyStatus)
    : undefined;
  const academicYearCode = first(raw.academicYearCode) || undefined;
  const viewAll = canViewAllDepartments(session.user);
  const departmentId = oversight ? effectiveDepartmentFilter(session.user, await resolveDepartmentParam(raw.department)) : undefined;
  const page = Math.max(1, Number.parseInt(first(raw.page) ?? "1", 10) || 1);
  const presetParam = first(raw.preset);
  const preset = isSearchPreset(presetParam) ? presetParam : undefined;
  const archivedParam = first(raw.archived);
  const archived = archivedParam === "include" || archivedParam === "only" ? archivedParam : undefined;

  const filters: ConsultancySearchFilters = {
    q,
    status,
    academicYearCode,
    departmentId,
    preset,
    archived,
    ...(oversight ? {} : { facultyInChargeId: session.user.id }),
  };

  const [result, deptOptions, yearRows] = await Promise.all([
    searchConsultancies(filters, undefined, { page, pageSize: PAGE_SIZE }),
    db.select({ id: departments.id, name: departments.name }).from(departments).orderBy(asc(departments.name)),
    db
      .select({ code: masterData.code })
      .from(masterData)
      .where(and(eq(masterData.category, "academic_year"), eq(masterData.isActive, true)))
      .orderBy(desc(masterData.code)),
  ]);

  const deptName = new Map(deptOptions.map((d) => [d.id, d.name]));
  const hasFilters = Boolean(q || status || academicYearCode || (viewAll && departmentId) || preset || archived);

  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ q, status, academicYearCode, department: viewAll ? departmentId : undefined, preset, archived })) {
      if (value) params.set(key, value);
    }
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return query ? `/consultancies?${query}` : "/consultancies";
  };

  const columns: DataTableColumn<Row>[] = [
    {
      header: "Consultancy",
      primary: true,
      cell: (r) => (
        <Link href={`/consultancies/${r.id}`} className="hover:underline">
          <span className="flex flex-col">
            <span className="font-medium text-foreground">{r.consultancyCode ?? "Draft"}</span>
            <span className="line-clamp-2 text-xs text-muted-foreground">{r.title}</span>
          </span>
        </Link>
      ),
    },
    { header: "Client", cell: (r) => r.clientOrganizationName ?? "—" },
    ...(viewAll ? [{ header: "Department", cell: (r: Row) => deptName.get(r.departmentId) ?? "—" }] : []),
    { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    { header: "Year", cell: (r) => r.academicYearCode },
    { header: "Value", className: "md:text-right", cell: (r) => (r.totalValue ? formatInr(Number(r.totalValue)) : "—") },
    {
      header: "",
      className: "text-right",
      cell: (r) => (
        <Link href={`/consultancies/${r.id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline md:min-h-0">
          View →
        </Link>
      ),
    },
  ];

  const canCreate = roles.some((r) => CREATOR_ROLES.includes(r));
  const newAction = canCreate ? (
    <Button asChild>
      <Link href="/consultancies/new">+ New Consultancy</Link>
    </Button>
  ) : undefined;


  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          preset
            ? SEARCH_PRESETS[preset]
            : archived === "only"
              ? "Archived Consultancies"
              : viewAll
                ? "All Consultancies"
                : oversight
                  ? `${deptName.get(session.user.departmentId ?? "") ?? "Department"} Consultancies`
                  : "My Consultancies"
        }
        subtitle={`${result.total.toLocaleString("en-IN")} consultanc${result.total === 1 ? "y" : "ies"}${hasFilters ? " matching your filters" : ""}`}
        action={newAction}
      />

      <ConsultancyListFilters
        key={q ?? ""}
        statuses={[...consultancyStatusEnum.enumValues]}
        academicYears={yearRows.map((y) => y.code)}
        departments={viewAll ? deptOptions : undefined}
      />

      <Card>
        <CardContent className="p-3 md:p-0">
          <DataTable
            columns={columns}
            data={result.rows}
            keyFor={(r) => r.id}
            emptyState={
              hasFilters ? (
                <EmptyState
                  icon={SearchX}
                  title="No consultancies match these filters"
                  description="Try a different search term or clear the filters."
                  action={
                    <Button asChild variant="secondary">
                      <Link href="/consultancies">Clear filters</Link>
                    </Button>
                  }
                  className="m-4"
                />
              ) : (
                <EmptyState
                  icon={FileText}
                  title={oversight ? "No consultancies yet" : "You don't have any consultancies yet"}
                  description={canCreate ? "Register the first one to see it here." : undefined}
                  action={newAction}
                  className="m-4"
                />
              )
            }
          />
        </CardContent>
      </Card>

      <Pagination page={page} pageSize={PAGE_SIZE} total={result.total} hrefFor={pageHref} />
    </div>
  );
}
