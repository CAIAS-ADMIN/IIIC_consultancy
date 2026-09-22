import { pgTable, uuid, integer, text, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { consultancies } from "./consultancies";
import { users } from "./users";

/**
 * Full JSON snapshot of a consultancy (and its child rows) taken before a
 * clarification-triggered edit, so the pre-clarification version stays
 * retrievable after resubmission (Phase 6).
 */
export const consultancyVersions = pgTable(
  "consultancy_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    reason: text("reason").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("consultancy_versions_unique_idx").on(table.consultancyId, table.versionNumber),
  ]
);
