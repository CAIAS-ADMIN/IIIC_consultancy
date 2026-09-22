"use client";

import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Department = { id: string; name: string; code: string };

const ALL_DEPARTMENTS = "all";

/**
 * Cosmetic shell chrome for oversight roles — cross-department/year filtering
 * is wired up in a later phase. Local component state only; selecting a
 * department here doesn't filter anything yet.
 */
export function DepartmentSwitcher() {
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [value, setValue] = React.useState(ALL_DEPARTMENTS);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/departments")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body: { data?: Department[] }) => {
        if (!cancelled) setDepartments(body.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setDepartments([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex items-center gap-3">
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="h-9 w-auto min-w-[9rem] text-sm" aria-label="Department filter">
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
      <span className="hidden whitespace-nowrap text-sm text-muted-foreground sm:inline">
        Academic Year 2026–27
      </span>
    </div>
  );
}
