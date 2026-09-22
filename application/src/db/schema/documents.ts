import { pgTable, uuid, varchar, integer, timestamp, index } from "drizzle-orm/pg-core";
import { consultancies } from "./consultancies";
import { users } from "./users";
import { progressUpdates } from "./progress-updates";
import { documentStatusEnum, confidentialityLevelEnum } from "./enums";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    documentCategory: varchar("document_category", { length: 100 }).notNull(),
    originalFileName: varchar("original_file_name", { length: 512 }).notNull(),
    objectKey: varchar("object_key", { length: 1024 }).notNull(),
    version: integer("version").notNull().default(1),
    confidentialityLevel: confidentialityLevelEnum("confidentiality_level")
      .notNull()
      .default("internal"),
    status: documentStatusEnum("status").notNull().default("uploading"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    /** Optional attachment link for `addProgressUpdate` (Phase 7) — a progress update may carry several supporting documents. */
    progressUpdateId: uuid("progress_update_id").references(() => progressUpdates.id, { onDelete: "set null" }),
  },
  (table) => [
    index("documents_consultancy_idx").on(table.consultancyId),
    index("documents_category_idx").on(table.consultancyId, table.documentCategory),
  ]
);
