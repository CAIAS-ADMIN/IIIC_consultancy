import { pgTable, uuid, text, date, timestamp, index } from "drizzle-orm/pg-core";
import { consultancies } from "./consultancies";
import { users } from "./users";

export const holds = pgTable(
  "holds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    startDate: date("start_date").notNull(),
    expectedResumeDate: date("expected_resume_date"),
    actualResumeDate: date("actual_resume_date"),
    authorisedBy: uuid("authorised_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("holds_consultancy_idx").on(table.consultancyId)]
);

export const cancellations = pgTable(
  "cancellations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    date: date("date").notNull(),
    initiatedBy: uuid("initiated_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    financialStatus: text("financial_status").notNull(),
    outstandingObligations: text("outstanding_obligations"),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("cancellations_consultancy_idx").on(table.consultancyId)]
);

export const terminations = pgTable(
  "terminations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    actualTerminationDate: date("actual_termination_date").notNull(),
    completedDeliverables: text("completed_deliverables"),
    outstandingDeliverables: text("outstanding_deliverables"),
    financialStatus: text("financial_status").notNull(),
    clientCommunication: text("client_communication"),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    initiatedBy: uuid("initiated_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("terminations_consultancy_idx").on(table.consultancyId)]
);
