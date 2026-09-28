import { and, count, desc, eq, gte, ilike, inArray, lte, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, consultancies, users } from "@/db/schema";

/** Entity types Finance may see in a record's audit trail (portal spec §46: "Financial scope"). */
export const FINANCIAL_AUDIT_ENTITY_TYPES = ["payment_transaction", "payment_schedule", "payment_adjustment", "closure_exception", "closure"];

export type AuditFilters = {
  consultancyId?: string;
  entityTypes?: string[];
  action?: string;
  /** Consultancy ID / title fragment. */
  q?: string;
  from?: string;
  to?: string;
};

function conditions(f: AuditFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (f.consultancyId) parts.push(eq(auditEvents.consultancyId, f.consultancyId));
  if (f.entityTypes && f.entityTypes.length > 0) parts.push(inArray(auditEvents.entityType, f.entityTypes));
  if (f.action) parts.push(eq(auditEvents.action, f.action));
  if (f.from) parts.push(gte(auditEvents.createdAt, new Date(`${f.from}T00:00:00`)));
  if (f.to) parts.push(lte(auditEvents.createdAt, new Date(`${f.to}T23:59:59.999`)));
  if (f.q) {
    const like = `%${f.q}%`;
    const match = or(ilike(consultancies.consultancyCode, like), ilike(consultancies.title, like));
    if (match) parts.push(match);
  }
  return parts.length > 0 ? and(...parts) : undefined;
}

export async function listAuditEvents(filters: AuditFilters, page = { limit: 50, offset: 0 }) {
  const where = conditions(filters);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: auditEvents.id,
        consultancyId: auditEvents.consultancyId,
        consultancyCode: consultancies.consultancyCode,
        entityType: auditEvents.entityType,
        entityId: auditEvents.entityId,
        action: auditEvents.action,
        actorName: users.name,
        actorEmail: users.email,
        actorRoles: auditEvents.actorRoles,
        oldValue: auditEvents.oldValue,
        newValue: auditEvents.newValue,
        comments: auditEvents.comments,
        requestIp: auditEvents.requestIp,
        userAgent: auditEvents.userAgent,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.actorId))
      .leftJoin(consultancies, eq(consultancies.id, auditEvents.consultancyId))
      .where(where)
      .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
      .limit(page.limit)
      .offset(page.offset),
    db
      .select({ total: count() })
      .from(auditEvents)
      .leftJoin(consultancies, eq(consultancies.id, auditEvents.consultancyId))
      .where(where),
  ]);
  return { rows, total };
}

export type AuditEventRow = Awaited<ReturnType<typeof listAuditEvents>>["rows"][number];

/** Distinct actions / entity types on record — options for the audit-trail filters. */
export async function listAuditFacets() {
  const [actions, entityTypes] = await Promise.all([
    db.selectDistinct({ value: auditEvents.action }).from(auditEvents).orderBy(auditEvents.action),
    db.selectDistinct({ value: auditEvents.entityType }).from(auditEvents).orderBy(auditEvents.entityType),
  ]);
  return { actions: actions.map((a) => a.value), entityTypes: entityTypes.map((e) => e.value) };
}
