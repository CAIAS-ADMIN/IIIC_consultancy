"use client";

import * as React from "react";
import { Filter, Lock, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { humanizeStatus } from "@/lib/status";
import type { SearchFilterKey } from "@/lib/consultancy/search-keys";

/** Keys are the backend's own search param names — see `SEARCH_FILTER_KEYS`. */
export type FilterState = Partial<Record<SearchFilterKey, string>>;

export type Option = { value: string; label: string };

const PAYMENT_STATUS_OPTIONS: Option[] = [
  { value: "not_invoiced", label: "Not Invoiced" },
  { value: "partially_received", label: "Partially Received" },
  { value: "fully_received", label: "Fully Received" },
  { value: "overdue", label: "Overdue" },
];

const YES_NO_OPTIONS: Option[] = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

function SelectFilter({
  id,
  label,
  value,
  allLabel,
  options,
  disabled,
  onChange,
}: {
  id: string;
  label: React.ReactNode;
  value?: string;
  allLabel: string;
  options: Option[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Select disabled={disabled} value={value || "all"} onValueChange={(v) => onChange(v === "all" ? "" : v)}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SearchFilterBar({
  filters,
  onChange,
  onReset,
  onApply,
  departments,
  faculty,
  statuses,
  isDepartmentLocked,
}: {
  filters: FilterState;
  onChange: (key: keyof FilterState, value: string) => void;
  onReset: () => void;
  onApply: () => void;
  departments: { id: string; name: string; code: string }[];
  faculty: Option[];
  statuses: string[];
  /** Faculty-only callers are scoped to their own department by the backend — shown as a locked filter, not silently ignored. */
  isDepartmentLocked: boolean;
}) {
  const [openSheet, setOpenSheet] = React.useState(false);

  const filterFields = (p: string) => (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${p}-id`} className="text-xs">
          Consultancy ID
        </Label>
        <Input
          id={`${p}-id`}
          placeholder="e.g. 2025-26/00012"
          value={filters.consultancyCode || ""}
          onChange={(e) => onChange("consultancyCode", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${p}-client`} className="text-xs">
          Client Name
        </Label>
        <Input
          id={`${p}-client`}
          placeholder="e.g. TechCorp"
          value={filters.clientName || ""}
          onChange={(e) => onChange("clientName", e.target.value)}
        />
      </div>

      <SelectFilter
        id={`${p}-dept`}
        label={
          isDepartmentLocked ? (
            <span className="inline-flex items-center gap-1">
              Department <Lock className="h-3 w-3" aria-label="Locked to your department" />
            </span>
          ) : (
            "Department"
          )
        }
        value={filters.departmentId}
        allLabel="All Departments"
        options={departments.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))}
        disabled={isDepartmentLocked}
        onChange={(v) => onChange("departmentId", v)}
      />

      <SelectFilter
        id={`${p}-faculty`}
        label="Faculty In-Charge"
        value={filters.facultyInChargeId}
        allLabel="All Faculty"
        options={faculty}
        onChange={(v) => onChange("facultyInChargeId", v)}
      />

      <SelectFilter
        id={`${p}-status`}
        label="Status"
        value={filters.status}
        allLabel="All Statuses"
        options={statuses.map((s) => ({ value: s, label: humanizeStatus(s) }))}
        onChange={(v) => onChange("status", v)}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${p}-ay`} className="text-xs">
          Academic Year
        </Label>
        <Input
          id={`${p}-ay`}
          placeholder="e.g. 2025-26"
          value={filters.academicYearCode || ""}
          onChange={(e) => onChange("academicYearCode", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${p}-from`} className="text-xs">
          Created From
        </Label>
        <Input id={`${p}-from`} type="date" value={filters.createdFrom || ""} onChange={(e) => onChange("createdFrom", e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${p}-to`} className="text-xs">
          Created To
        </Label>
        <Input id={`${p}-to`} type="date" value={filters.createdTo || ""} onChange={(e) => onChange("createdTo", e.target.value)} />
      </div>

      <SelectFilter
        id={`${p}-pay`}
        label="Payment Status"
        value={filters.paymentStatus}
        allLabel="All Payment Statuses"
        options={PAYMENT_STATUS_OPTIONS}
        onChange={(v) => onChange("paymentStatus", v)}
      />

      <SelectFilter
        id={`${p}-ip`}
        label="IP Involved"
        value={filters.ipInvolvement}
        allLabel="Any"
        options={YES_NO_OPTIONS}
        onChange={(v) => onChange("ipInvolvement", v)}
      />

      <SelectFilter
        id={`${p}-res`}
        label="CAIAS Resource Usage"
        value={filters.resourceUsage}
        allLabel="Any"
        options={YES_NO_OPTIONS}
        onChange={(v) => onChange("resourceUsage", v)}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      {/* Desktop: inline bar */}
      <form
        className="hidden flex-col gap-4 md:flex"
        onSubmit={(e) => {
          e.preventDefault();
          onApply();
        }}
      >
        {filterFields("flt")}
        <div className="flex justify-end gap-2 border-t border-border pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onReset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button type="submit" size="sm" className="gap-1.5">
            <Search className="h-3.5 w-3.5" />
            Apply Filters
          </Button>
        </div>
      </form>

      {/* Mobile: "Filters" sheet */}
      <div className="flex items-center justify-between md:hidden">
        <Sheet open={openSheet} onOpenChange={setOpenSheet}>
          <SheetTrigger asChild>
            <Button variant="secondary" className="w-full gap-2">
              <Filter className="h-4 w-4" />
              Search & Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
            <div className="border-b border-border pb-2">
              <SheetTitle>Search & Filter</SheetTitle>
            </div>
            <form
              className="flex flex-col gap-4 py-4"
              onSubmit={(e) => {
                e.preventDefault();
                onApply();
                setOpenSheet(false);
              }}
            >
              {filterFields("flt-m")}
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <Button type="submit" className="w-full gap-1.5">
                  <Search className="h-4 w-4" />
                  Apply Filters
                </Button>
                <Button type="button" variant="secondary" onClick={onReset} className="w-full gap-1.5">
                  <RotateCcw className="h-4 w-4" />
                  Reset Filters
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
