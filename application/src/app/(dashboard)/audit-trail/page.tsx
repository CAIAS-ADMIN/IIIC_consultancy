import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listAuditEvents, listAuditFacets } from "@/db/queries/audit";
import { PageHeader } from "@/components/shell/page-header";
import { AuditTrailList } from "@/components/consultancy/audit-trail-list";
import { AuditTrailFilters } from "@/components/admin/audit-trail-filters";
import { Pagination, parsePage } from "@/components/ui/pagination";

const PAGE_SIZE = 50;
/** Spec §46 "View Audit Trail": CAIAS admin — all; audit user — all, read-only. */
const AUDIT_ROLES = ["iiic_admin", "system_admin", "audit_readonly"];

type Params = { q?: string; action?: string; entity?: string; from?: string; to?: string; page?: string };

const dateOnly = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export default async function AuditTrailPage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!session.user.roles.some((r) => AUDIT_ROLES.includes(r))) redirect("/dashboard");

  const raw = await searchParams;
  const filters = {
    q: raw.q?.trim() || undefined,
    action: raw.action || undefined,
    entityTypes: raw.entity ? [raw.entity] : undefined,
    from: dateOnly(raw.from),
    to: dateOnly(raw.to),
  };
  const requested = Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1);
  const [{ rows, total }, facets] = await Promise.all([
    listAuditEvents(filters, { limit: PAGE_SIZE, offset: (requested - 1) * PAGE_SIZE }),
    listAuditFacets(),
  ]);
  const page = parsePage(raw.page, Math.ceil(total / PAGE_SIZE));

  const hrefFor = (p: number) => {
    const params = new URLSearchParams(Object.entries(raw).filter(([k, v]) => k !== "page" && v) as [string, string][]);
    params.set("page", String(p));
    return `/audit-trail?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Audit Trail" subtitle={`Every material action across the portal — ${total.toLocaleString("en-IN")} event${total === 1 ? "" : "s"} match.`} />
      <AuditTrailFilters actions={facets.actions} entityTypes={facets.entityTypes} />
      <AuditTrailList events={rows} showRecord />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={hrefFor} />
    </div>
  );
}
