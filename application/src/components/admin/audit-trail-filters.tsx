"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all";

function humanize(value: string): string {
  return value.replace(/[_-]/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** URL-driven filters for the global audit trail (every filtered view is a shareable URL). */
export function AuditTrailFilters({ actions, entityTypes }: { actions: string[]; entityTypes: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = React.useState(searchParams.get("q") ?? "");

  function update(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== ALL) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <form
        className="flex gap-2 sm:col-span-2"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: q.trim() || null });
        }}
      >
        <Input aria-label="Consultancy ID or title" placeholder="Consultancy ID or title" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" variant="secondary" size="icon" aria-label="Search">
          <Search className="h-4 w-4" aria-hidden />
        </Button>
      </form>
      <Select value={searchParams.get("action") ?? ALL} onValueChange={(v) => update({ action: v })}>
        <SelectTrigger aria-label="Action">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All actions</SelectItem>
          {actions.map((a) => (
            <SelectItem key={a} value={a}>
              {humanize(a)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("entity") ?? ALL} onValueChange={(v) => update({ entity: v })}>
        <SelectTrigger aria-label="Record type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All record types</SelectItem>
          {entityTypes.map((t) => (
            <SelectItem key={t} value={t}>
              {humanize(t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" aria-label="From date" defaultValue={searchParams.get("from") ?? ""} onChange={(e) => update({ from: e.target.value || null })} />
        <Input type="date" aria-label="To date" defaultValue={searchParams.get("to") ?? ""} onChange={(e) => update({ to: e.target.value || null })} />
      </div>
    </div>
  );
}
