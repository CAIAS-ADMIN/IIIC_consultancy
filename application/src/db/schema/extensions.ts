import { pgTable, uuid, boolean, text, date, timestamp, index } from "drizzle-orm/pg-core";
import { consultancies } from "./consultancies";
import { users } from "./users";
import { documents } from "./documents";
import { extensionStatusEnum } from "./enums";

export const extensions = pgTable(
  "extensions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    originalCompletionDate: date("original_completion_date").notNull(),
    proposedCompletionDate: date("proposed_completion_date").notNull(),
    reason: text("reason").notNull(),
    revisedTimeline: text("revised_timeline"),
    clientConsent: boolean("client_consent").notNull().default(false),
    supportingDocumentId: uuid("supporting_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    status: extensionStatusEnum("status").notNull().default("requested"),
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("extensions_consultancy_idx").on(table.consultancyId)]
);
