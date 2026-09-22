import { pgTable, uuid, varchar, text, integer, date, timestamp, index } from "drizzle-orm/pg-core";
import { consultancies } from "./consultancies";
import { documents } from "./documents";

export const clientAcceptances = pgTable(
  "client_acceptances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    acceptedByName: varchar("accepted_by_name", { length: 255 }).notNull(),
    acceptanceDate: date("acceptance_date").notNull(),
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
    rating: integer("rating"),
    comments: text("comments"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("client_feedback_consultancy_idx").on(table.consultancyId)]
);
