"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type DepartmentOption = { id: string; name: string };

const ALL_DEPARTMENTS = "all";

/**
 * Oversight-role department filter, driven by the `?department=` URL param
 * so the server-rendered page it sits on actually filters by it (and the
 * view is shareable/bookmarkable). Changing it drops `page` — page 3 of the
 * old department's results rarely exists in the new one.
 */
export function DepartmentSwitcher({ departments }: { departments: DepartmentOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const value = searchParams.get("department") ?? ALL_DEPARTMENTS;

  const onChange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === ALL_DEPARTMENTS) params.delete("department");
    else params.set("department", next);
    params.delete("page");
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-11 w-full min-w-[11rem] sm:w-auto md:h-9" aria-label="Filter by department" aria-busy={isPending}>
        <SelectValue placeholder="All Departments" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_DEPARTMENTS}>All Departments</SelectItem>
        {departments.map((dept) => (
          <SelectItem key={dept.id} value={dept.id}>
            {dept.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
