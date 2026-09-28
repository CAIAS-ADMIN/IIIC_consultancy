import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { History } from "lucide-react";
import type { AuditEventRow } from "@/db/queries/audit";

const SKIP_KEYS = new Set(["updatedAt", "createdAt", "id", "consultancyId"]);

function humanize(value: string): string {
  return value.replace(/[_-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return Array.isArray(value) ? `${value.length} item(s)` : "…";
  const text = String(value);
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

/** "status: Draft → Submitted" style lines for the fields an event actually changed. */
function changes(oldValue: unknown, newValue: unknown): string[] {
  const before = (oldValue && typeof oldValue === "object" ? oldValue : {}) as Record<string, unknown>;
  const after = (newValue && typeof newValue === "object" ? newValue : {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => !SKIP_KEYS.has(k));
  const changed = keys.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  const lines = changed.slice(0, 5).map((k) => {
    const hasBefore = k in before;
    return hasBefore ? `${humanize(k)}: ${show(before[k])} → ${show(after[k])}` : `${humanize(k)}: ${show(after[k])}`;
  });
  if (changed.length > 5) lines.push(`+${changed.length - 5} more field(s)`);
  return lines;
}

/**
 * Read-only audit trail (portal spec §37 / §63): when, who (and in which
 * role), what, previous → new, and any reason given. Immutable by
 * construction — `audit_events` rejects UPDATE/DELETE at the database.
 */
export function AuditTrailList({ events, showRecord = false }: { events: AuditEventRow[]; showRecord?: boolean }) {
  if (events.length === 0) {
    return <EmptyState icon={History} title="No audit events" description="Actions on this record will appear here." />;
  }
  return (
    <ol className="flex flex-col gap-2">
      {events.map((e) => {
        const lines = changes(e.oldValue, e.newValue);
        return (
          <li key={e.id} className="rounded-md border border-border p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="font-medium text-foreground">
                {humanize(e.action)} <span className="font-normal text-muted-foreground">· {humanize(e.entityType)}</span>
              </span>
              <time className="text-xs text-muted-foreground" dateTime={new Date(e.createdAt).toISOString()}>
                {new Date(e.createdAt).toLocaleString("en-IN")}
              </time>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {e.actorName ?? e.actorEmail ?? "System"}
              {e.actorRoles && e.actorRoles.length > 0 && ` (${e.actorRoles.map(humanize).join(", ")})`}
              {e.requestIp && ` · ${e.requestIp}`}
              {showRecord && e.consultancyId && (
                <>
                  {" · "}
                  <Link href={`/consultancies/${e.consultancyId}`} className="text-primary underline underline-offset-2">
                    {e.consultancyCode ?? "Draft"}
                  </Link>
                </>
              )}
            </p>
            {lines.length > 0 && (
              <ul className="mt-1.5 flex flex-col gap-0.5 text-xs text-foreground">
                {lines.map((line) => (
                  <li key={line} className="break-words">
                    {line}
                  </li>
                ))}
              </ul>
            )}
            {e.comments && <p className="mt-1.5 text-xs text-muted-foreground">Reason: {e.comments}</p>}
          </li>
        );
      })}
    </ol>
  );
}
