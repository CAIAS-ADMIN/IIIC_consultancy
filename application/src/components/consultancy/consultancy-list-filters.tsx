"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DepartmentSwitcher, type DepartmentOption } from "@/components/shell/department-switcher";
import { humanizeStatus } from "@/lib/status";

const ALL = "all";

/**
 * URL-driven filters for the consultancy list — the server page reads the
 * same params, so every filtered view is a real, shareable URL and the
 * browser back button works. Any change resets to page 1.
 */
export function ConsultancyListFilters({
  statuses,
  academicYears,
  departments,
}: {
  statuses: string[];
  academicYears: string[];
  /** Omitted for faculty ("My Consultancies" is already limited to their own). */
  departments?: DepartmentOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const [q, setQ] = React.useState(searchParams.get("q") ?? "");

  const update = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== ALL) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  const hasFilters = ["q", "status", "academicYearCode", "department"].some((k) => searchParams.has(k));

  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center" aria-busy={isPending}>
      <form
        role="search"
        className="relative md:w-72"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: q.trim() || null });
        }}
      >
        <label htmlFor="consultancy-search" className="sr-only">
          Search consultancies
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id="consultancy-search"
          type="search"
          placeholder="Search ID, title or client"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => q.trim() !== (searchParams.get("q") ?? "") && update({ q: q.trim() || null })}
          className="h-11 pl-9 md:h-9"
        />
      </form>

      <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap">
        <Select value={searchParams.get("status") ?? ALL} onValueChange={(v) => update({ status: v })}>
          <SelectTrigger className="h-11 md:h-9 md:w-48" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {humanizeStatus(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={searchParams.get("academicYearCode") ?? ALL} onValueChange={(v) => update({ academicYearCode: v })}>
          <SelectTrigger className="h-11 md:h-9 md:w-40" aria-label="Filter by academic year">
            <SelectValue placeholder="All years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All years</SelectItem>
            {academicYears.map((y) => (
              <SelectItem key={y} value={y}>
                AY {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {departments && (
          <div className="col-span-2">
            <DepartmentSwitcher departments={departments} />
          </div>
        )}
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          className="h-11 gap-1.5 self-start md:h-9"
          onClick={() => {
            setQ("");
            startTransition(() => router.replace(pathname, { scroll: false }));
          }}
        >
          <X className="h-4 w-4" aria-hidden />
          Clear filters
        </Button>
      )}
    </div>
  );
}
