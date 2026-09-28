"use client";

import * as React from "react";
import { FINAL_OUTCOME_OPTIONS, RATING_LABELS } from "@/lib/validation/closure";
import Link from "next/link";
import { FileSpreadsheet, FileText, Eye, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { HorizontalBarChart, DonutChart, type ChartDataItem } from "./reports-charts";
import { SearchFilterBar, type FilterState, type Option } from "./search-filter-bar";
import { humanizeStatus, type AnyStatus } from "@/lib/status";
import { formatInr, formatInrCompact } from "@/lib/format";

export type DepartmentItem = { id: string; name: string; code: string };

type CountRow = { key: string; count: number };
type MoneyRow = { key: string; totalValue: number; totalReceived: number; amountPending: number; tds?: number };

export type SummaryReportData = {
  byStatus: CountRow[];
  byDepartment: CountRow[];
  byAcademicYear: CountRow[];
  byClientType: CountRow[];
  byCategory: CountRow[];
  byFaculty: CountRow[];
  byConsultancyCategory: CountRow[];
  byNature: CountRow[];
  byOutcome: CountRow[];
  satisfaction: { byRating: CountRow[]; average: number | null; responses: number };
  highlights: { completed: number; ipGenerated: number; resourceIntensive: number; multidisciplinary: number };
};

export type FinancialReportData = {
  byDepartment: MoneyRow[];
  byAcademicYear: MoneyRow[];
  overduePayments: number;
};

type SearchResultRow = {
  id: string;
  consultancyCode: string | null;
  title: string;
  status: AnyStatus;
  departmentId: string;
  academicYearCode: string;
  clientOrganizationName: string | null;
  /** `numeric` column — arrives as a string (or null) over JSON. */
  totalValue: string | number | null;
};

const PAGE_SIZE = 20;
type Tab = "overview" | "financials" | "search";

function toQuery(filters: FilterState, extra: Record<string, string>) {
  const params = new URLSearchParams(extra);
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  return params.toString();
}

function CountTable({ title, rows, labelFor }: { title: string; rows: CountRow[]; labelFor: (key: string) => React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">No data</p>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border">
          {[...rows]
            .sort((a, b) => b.count - a.count)
            .map((r) => (
              <div key={r.key} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <span className="min-w-0 break-words text-foreground">{labelFor(r.key)}</span>
                <span className="font-mono font-semibold text-foreground">{r.count}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export function ReportsHub({
  summaryData,
  financialData,
  departments,
  faculty,
  statuses,
  areaLabels,
  orgTypeLabels,
  categoryLabels = {},
  natureLabels = {},
  scopedDepartmentId,
}: {
  summaryData: SummaryReportData;
  financialData: FinancialReportData;
  departments: DepartmentItem[];
  faculty: Option[];
  statuses: string[];
  areaLabels: Record<string, string>;
  orgTypeLabels: Record<string, string>;
  categoryLabels?: Record<string, string>;
  natureLabels?: Record<string, string>;
  /** `undefined` = unrestricted; a department id = locked to it; `null` = faculty with no department on record. */
  scopedDepartmentId: string | null | undefined;
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState<Tab>("overview");

  const deptName = React.useCallback(
    (id: string) => departments.find((d) => d.id === id)?.name ?? id,
    [departments]
  );

  const isDepartmentLocked = scopedDepartmentId !== undefined;
  const baseFilters: FilterState = React.useMemo(
    () => (scopedDepartmentId ? { departmentId: scopedDepartmentId } : {}),
    [scopedDepartmentId]
  );

  // `filters` is what's being edited; `applied` is what the current results
  // (and therefore pagination + export) actually reflect.
  const [filters, setFilters] = React.useState<FilterState>(baseFilters);
  const [applied, setApplied] = React.useState<FilterState>(baseFilters);
  const [searchRows, setSearchRows] = React.useState<SearchResultRow[]>([]);
  const [searchTotal, setSearchTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = React.useState(false);
  const [exporting, setExporting] = React.useState<"csv" | "pdf" | null>(null);

  const runSearch = async (nextPage: number, nextFilters: FilterState) => {
    setIsLoadingSearch(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/consultancies/search?${toQuery(nextFilters, { page: String(nextPage), pageSize: String(PAGE_SIZE) })}`);
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Search failed");
      setSearchRows(json.data ?? []);
      setSearchTotal(json.total ?? 0);
      setPage(json.page ?? nextPage);
      setApplied(nextFilters);
    } catch (err) {
      toast({
        title: "Search failed",
        description: err instanceof Error ? err.message : "Could not load search results.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSearch(false);
    }
  };

  const openTab = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === "search" && !hasSearched) void runSearch(1, applied);
  };

  const handleReset = () => {
    setFilters(baseFilters);
    void runSearch(1, baseFilters);
  };

  const handleExport = async (format: "csv" | "pdf") => {
    setExporting(format);
    try {
      const res = await fetch(`/api/consultancies/export?${toQuery(applied, { format })}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(typeof json.error === "string" ? json.error : `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `consultancies-export.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({
        title: "Export ready",
        description: `${searchTotal} matching record${searchTotal === 1 ? "" : "s"} exported as ${format.toUpperCase()}.`,
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : `Could not export ${format.toUpperCase()}.`,
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  const areaLabel = (code: string) => areaLabels[code] ?? code;
  const orgTypeLabel = (code: string) => (code === "unknown" ? "Not specified" : (orgTypeLabels[code] ?? code));

  const statusChartData: ChartDataItem[] = summaryData.byStatus.map((s) => ({ label: humanizeStatus(s.key), value: s.count }));
  const departmentChartData: ChartDataItem[] = summaryData.byDepartment.map((d) => ({ label: deptName(d.key), value: d.count }));
  const academicYearChartData: ChartDataItem[] = [...summaryData.byAcademicYear]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((a) => ({ label: `AY ${a.key}`, value: a.count }));
  const clientTypeChartData: ChartDataItem[] = summaryData.byClientType.map((c) => ({ label: orgTypeLabel(c.key), value: c.count }));
  const categoryChartData: ChartDataItem[] = [...summaryData.byCategory]
    .sort((a, b) => b.count - a.count)
    .map((c) => ({ label: areaLabel(c.key), value: c.count }));

  const financialDeptChart: ChartDataItem[] = [...financialData.byDepartment]
    .sort((a, b) => b.totalValue - a.totalValue)
    .map((d) => ({ label: deptName(d.key), value: d.totalValue }));
  const financialYearChart: ChartDataItem[] = [...financialData.byAcademicYear]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((a) => ({ label: `AY ${a.key}`, value: a.totalValue }));

  const totalValue = financialData.byDepartment.reduce((acc, d) => acc + d.totalValue, 0);
  const totalReceived = financialData.byDepartment.reduce((acc, d) => acc + d.totalReceived, 0);
  const totalPending = financialData.byDepartment.reduce((acc, d) => acc + d.amountPending, 0);
  const totalTds = financialData.byDepartment.reduce((acc, d) => acc + (d.tds ?? 0), 0);
  const labelOr = (labels: Record<string, string>) => (key: string) => (key === "unspecified" ? "Not specified" : (labels[key] ?? key));
  const outcomeLabel = (key: string) => FINAL_OUTCOME_OPTIONS.find((o) => o.code === key)?.label ?? "Not specified";

  const searchColumns: DataTableColumn<SearchResultRow>[] = [
    { header: "Consultancy ID", cell: (r) => <span className="font-mono text-xs">{r.consultancyCode ?? "Draft"}</span>, primary: true },
    { header: "Title", cell: (r) => <span className="font-medium text-foreground">{r.title}</span> },
    { header: "Client", cell: (r) => r.clientOrganizationName ?? "—" },
    { header: "Department", cell: (r) => deptName(r.departmentId) },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    { header: "Academic Year", cell: (r) => r.academicYearCode },
    { header: "Value", cell: (r) => (r.totalValue == null ? "—" : formatInr(Number(r.totalValue))) },
    {
      header: "Action",
      cell: (r) => (
        <Link
          href={`/consultancies/${r.id}`}
          className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-primary hover:underline md:min-h-0"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden />
          View →
        </Link>
      ),
    },
  ];

  const pageCount = Math.max(1, Math.ceil(searchTotal / PAGE_SIZE));
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "financials", label: "Financials" },
    { id: "search", label: "Search & Export" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {scopedDepartmentId && (
        <div className="rounded-md border border-status-warning-fg/20 bg-status-warning-bg px-4 py-2.5 text-sm text-status-warning-fg">
          <strong>Department scope:</strong> reports, search and exports are limited to your department ({deptName(scopedDepartmentId)}).
        </div>
      )}
      {scopedDepartmentId === null && (
        <div className="rounded-md border border-status-warning-fg/20 bg-status-warning-bg px-4 py-2.5 text-sm text-status-warning-fg">
          <strong>No department on record:</strong> reports are scoped to your own department, but your account has none assigned yet, so nothing can be shown. Contact the IIIC office.
        </div>
      )}

      <div role="tablist" aria-label="Report sections" className="flex overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => openTab(t.id)}
            className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 md:grid-cols-2">
            <DonutChart title="By Status" subtitle="Distribution across workflow stages" data={statusChartData} />
            <HorizontalBarChart title="By Department" subtitle="Consultancies registered per department" data={departmentChartData} />
            <HorizontalBarChart title="By Academic Year" data={academicYearChartData} />
            <DonutChart title="By Client Type" subtitle="Client organization classification" data={clientTypeChartData} />
          </div>
          <HorizontalBarChart title="By Category" subtitle="Consultancy area" data={categoryChartData} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Summary Tables</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <CountTable title="By Status" rows={summaryData.byStatus} labelFor={(k) => <StatusBadge status={k as AnyStatus} />} />
                <CountTable title="By Department" rows={summaryData.byDepartment} labelFor={deptName} />
                <CountTable title="By Academic Year" rows={summaryData.byAcademicYear} labelFor={(k) => `AY ${k}`} />
                <CountTable title="By Client Type" rows={summaryData.byClientType} labelFor={orgTypeLabel} />
                <CountTable title="By Consultancy Area" rows={summaryData.byCategory} labelFor={areaLabel} />
                <CountTable title="By Consultancy Category" rows={summaryData.byConsultancyCategory} labelFor={labelOr(categoryLabels)} />
                <CountTable title="By Nature of Consultancy" rows={summaryData.byNature} labelFor={labelOr(natureLabels)} />
                <CountTable title="By Faculty" rows={summaryData.byFaculty} labelFor={(k) => k} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Outcomes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <StatTile size="sm" label="Completed" value={summaryData.highlights.completed} />
                <StatTile size="sm" label="IP-generating" value={summaryData.highlights.ipGenerated} />
                <StatTile size="sm" label="Resource-intensive" value={summaryData.highlights.resourceIntensive} />
                <StatTile size="sm" label="Multidisciplinary" value={summaryData.highlights.multidisciplinary} />
                <StatTile
                  size="sm"
                  label={`Client Satisfaction (${summaryData.satisfaction.responses})`}
                  value={summaryData.satisfaction.average === null ? "—" : `${summaryData.satisfaction.average}/5`}
                  tone="primary"
                />
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <CountTable title="Final Outcome (closed records)" rows={summaryData.byOutcome} labelFor={outcomeLabel} />
                <CountTable
                  title="Client Satisfaction Ratings"
                  rows={summaryData.satisfaction.byRating}
                  labelFor={(k) => `${k} — ${RATING_LABELS[Number(k)] ?? ""}`}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "financials" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <StatTile label="Total Value Signed" value={formatInrCompact(totalValue)} tone="primary" />
            <StatTile label="Total Received" value={formatInrCompact(totalReceived)} />
            <StatTile label="Total Pending" value={formatInrCompact(totalPending)} tone="accent" />
            <StatTile label="Payments Overdue" value={financialData.overduePayments} tone={financialData.overduePayments > 0 ? "danger" : "neutral"} />
            <StatTile label="TDS Deducted" value={formatInrCompact(totalTds)} />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <HorizontalBarChart title="Value by Department" data={financialDeptChart} formatValue={formatInrCompact} />
            <HorizontalBarChart title="Value by Academic Year" data={financialYearChart} formatValue={formatInrCompact} />
          </div>

          {[
            { title: "By Department", rows: financialData.byDepartment, label: deptName },
            { title: "By Academic Year", rows: financialData.byAcademicYear, label: (k: string) => `AY ${k}` },
          ].map((section) => (
            <Card key={section.title}>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Financial Summary {section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <FinancialTable rows={section.rows} labelFor={section.label} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === "search" && (
        <div className="flex flex-col gap-6">
          <SearchFilterBar
            filters={filters}
            onChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
            onReset={handleReset}
            onApply={() => runSearch(1, filters)}
            departments={departments}
            faculty={faculty}
            statuses={statuses}
            clientTypes={Object.entries(orgTypeLabels).map(([value, label]) => ({ value, label }))}
            categories={Object.entries(categoryLabels).map(([value, label]) => ({ value, label }))}
            isDepartmentLocked={isDepartmentLocked}
          />

          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {isLoadingSearch ? (
                "Searching…"
              ) : (
                <>
                  <span className="font-semibold text-foreground">{searchTotal}</span> matching record{searchTotal === 1 ? "" : "s"}
                </>
              )}
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                variant="secondary"
                onClick={() => handleExport("csv")}
                disabled={exporting !== null || isLoadingSearch || searchTotal === 0}
                className="flex-1 gap-1.5 sm:flex-none"
              >
                <FileSpreadsheet className="h-4 w-4" aria-hidden />
                {exporting === "csv" ? "Exporting…" : "Export CSV"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleExport("pdf")}
                disabled={exporting !== null || isLoadingSearch || searchTotal === 0}
                className="flex-1 gap-1.5 sm:flex-none"
              >
                <FileText className="h-4 w-4" aria-hidden />
                {exporting === "pdf" ? "Generating…" : "Export PDF"}
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-3 md:p-0">
              {isLoadingSearch ? (
                <div className="flex flex-col gap-3 p-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <DataTable
                  columns={searchColumns}
                  data={searchRows}
                  keyFor={(r) => r.id}
                  emptyState={
                    <EmptyState
                      icon={SearchX}
                      title="No matching consultancies"
                      description="Try removing a filter or widening the date range."
                      className="m-4"
                    />
                  }
                />
              )}
            </CardContent>
          </Card>

          {searchTotal > PAGE_SIZE && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={page <= 1 || isLoadingSearch} onClick={() => runSearch(page - 1, applied)}>
                  Previous
                </Button>
                <Button variant="secondary" disabled={page >= pageCount || isLoadingSearch} onClick={() => runSearch(page + 1, applied)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FinancialTable({ rows, labelFor }: { rows: MoneyRow[]; labelFor: (key: string) => string }) {
  if (rows.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">No financial data recorded yet.</p>;
  }
  return (
    <>
      {/* Desktop table */}
      <table className="hidden w-full text-left text-sm md:table">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="p-3 font-medium">Name</th>
            <th className="p-3 text-right font-medium">Value</th>
            <th className="p-3 text-right font-medium">Received</th>
            <th className="p-3 text-right font-medium">Pending</th>
            <th className="p-3 text-right font-medium">TDS</th>
            <th className="p-3 text-right font-medium">Realized</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="p-3 font-medium text-foreground">{labelFor(r.key)}</td>
              <td className="p-3 text-right font-mono">{formatInr(r.totalValue)}</td>
              <td className="p-3 text-right font-mono text-status-success-fg">{formatInr(r.totalReceived)}</td>
              <td className="p-3 text-right font-mono text-status-warning-fg">{formatInr(r.amountPending)}</td>
              <td className="p-3 text-right font-mono">{formatInr(r.tds ?? 0)}</td>
              <td className="p-3 text-right font-semibold">{r.totalValue > 0 ? Math.round((r.totalReceived / r.totalValue) * 100) : 0}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Mobile: stacked cards, numbers stay readable at 375px */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((r) => (
          <div key={r.key} className="rounded-md border border-border p-3 text-sm">
            <p className="mb-2 font-semibold text-foreground">{labelFor(r.key)}</p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Value</dt>
              <dd className="text-right font-mono">{formatInr(r.totalValue)}</dd>
              <dt className="text-muted-foreground">Received</dt>
              <dd className="text-right font-mono text-status-success-fg">{formatInr(r.totalReceived)}</dd>
              <dt className="text-muted-foreground">Pending</dt>
              <dd className="text-right font-mono text-status-warning-fg">{formatInr(r.amountPending)}</dd>
              <dt className="text-muted-foreground">TDS</dt>
              <dd className="text-right font-mono">{formatInr(r.tds ?? 0)}</dd>
              <dt className="text-muted-foreground">Realized</dt>
              <dd className="text-right font-semibold">{r.totalValue > 0 ? Math.round((r.totalReceived / r.totalValue) * 100) : 0}%</dd>
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}
