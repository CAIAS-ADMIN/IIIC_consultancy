import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { consultancies } from "./consultancies";
import { users } from "./users";

/**
 * Append-only. `created_at` only — no `updated_at`, no soft-delete column.
 * A BEFORE UPDATE/DELETE trigger (see drizzle/0000_*.sql custom SQL, added in
 * the Phase 1 migration) rejects any mutation of existing rows at the DB
 * level, so this is enforced even if application code tries to bypass it.
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id").references(() => consultancies.id, {
      onDelete: "restrict",
    }),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: varchar("entity_id", { length: 255 }).notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    comments: text("comments"),
    /** Portal spec §63 — the actor's role(s) when the action happened, and where it came from. */
    actorRoles: text("actor_roles").array(),
    requestIp: varchar("request_ip", { length: 64 }),
    userAgent: varchar("user_agent", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_consultancy_idx").on(table.consultancyId),
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
  ]
);
