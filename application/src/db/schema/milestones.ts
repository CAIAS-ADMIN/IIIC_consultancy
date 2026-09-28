import { pgTable, uuid, varchar, text, date, timestamp, index } from "drizzle-orm/pg-core";
import { consultancies } from "./consultancies";
import { deliverables } from "./deliverables";
import { users } from "./users";
import { milestoneStatusEnum } from "./enums";
import { documents } from "./documents";

export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    deliverableId: uuid("deliverable_id").references(() => deliverables.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    /** Planned start (portal spec v2 Screen 9). `plannedDate` is the expected completion. */
    startDate: date("start_date"),
    plannedDate: date("planned_date").notNull(),
    actualStartDate: date("actual_start_date"),
    /** Actual completion. */
    actualDate: date("actual_date"),
    /** Free-text responsible person for milestones planned at registration, when they aren't a portal user. */
    responsiblePerson: varchar("responsible_person", { length: 255 }),
    status: milestoneStatusEnum("status").notNull().default("not_started"),
    responsibleConsultantId: uuid("responsible_consultant_id").references(() => users.id, {
      onDelete: "set null",
    }),
    remarks: text("remarks"),
    evidenceDocumentId: uuid("evidence_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("milestones_consultancy_idx").on(table.consultancyId)]
);
