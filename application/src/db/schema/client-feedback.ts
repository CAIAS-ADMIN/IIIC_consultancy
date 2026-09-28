import { pgTable, uuid, varchar, text, integer, date, timestamp, index } from "drizzle-orm/pg-core";
import { consultancies } from "./consultancies";
import { documents } from "./documents";
import { users } from "./users";

export const clientAcceptances = pgTable(
  "client_acceptances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    /** yes | no | not_required (Screen 22). Older rows (before this column) were all "yes". */
    acceptanceStatus: varchar("acceptance_status", { length: 20 }).notNull().default("yes"),
    /** Client representative — required when acceptance is "yes". */
    acceptedByName: varchar("accepted_by_name", { length: 255 }),
    acceptanceDate: date("acceptance_date"),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    remarks: text("remarks"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("client_acceptances_consultancy_idx").on(table.consultancyId)]
);

export const clientFeedback = pgTable(
  "client_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    feedbackDate: date("feedback_date").notNull(),
    /** Overall satisfaction, 1 (Poor) – 5 (Excellent). */
    rating: integer("rating"),
    comments: text("comments"),
    suggestions: text("suggestions"),
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("client_feedback_consultancy_idx").on(table.consultancyId)]
);
