import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { auditEvents, users } from "@/db/schema";
import { listMasterData } from "@/db/queries/master-data";
import { PageHeader } from "@/components/shell/page-header";
import { MasterDataHub, type AuditEventItem } from "@/components/admin/master-data-hub";

export default async function MasterDataPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }
  if (!session.user.roles.includes("system_admin")) {
    redirect("/dashboard");
  }

  const [items, auditRows] = await Promise.all([
    listMasterData(),
    db
      .select({
        id: auditEvents.id,
        entityId: auditEvents.entityId,
        action: auditEvents.action,
        actorName: users.name,
        actorEmail: users.email,
        oldValue: auditEvents.oldValue,
        newValue: auditEvents.newValue,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.actorId))
      .where(eq(auditEvents.entityType, "master_data"))
      .orderBy(desc(auditEvents.createdAt))
      .limit(50),
  ]);

  const auditLogs: AuditEventItem[] = auditRows.map((r) => ({
    id: r.id,
    entityId: r.entityId,
    action: r.action,
    actor: r.actorName ?? r.actorEmail ?? "Unknown user",
    oldValue: (r.oldValue as Record<string, unknown> | null) ?? null,
    newValue: (r.newValue as Record<string, unknown> | null) ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Master Data" subtitle="Dropdown values used across the portal. Changes apply immediately — no deploy needed." />
      <MasterDataHub
        items={items.map((m) => ({
          id: m.id,
          category: m.category,
          code: m.code,
          label: m.label,
          sortOrder: m.sortOrder,
          isActive: m.isActive,
        }))}
        auditLogs={auditLogs}
      />
    </div>
  );
}
