import { pgTable, uuid, text, numeric, date, timestamp, index } from "drizzle-orm/pg-core";
import { consultancies } from "./consultancies";
import { users } from "./users";
import { documents } from "./documents";
import { closureStatusEnum, deliverableCompletionEnum } from "./enums";

export const closures = pgTable(
  "closures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    actualCompletionDate: date("actual_completion_date").notNull(),
    deliverableCompletionStatus: deliverableCompletionEnum("deliverable_completion_status").notNull(),
    partialReason: text("partial_reason"),
    finalOutcomes: text("final_outcomes").notNull(),
    finalReportDocumentId: uuid("final_report_document_id").references(() => documents.id, {
      onDelete: "restrict",
    }),
    status: closureStatusEnum("status").notNull().default("requested"),
    verifiedBy: uuid("verified_by").references(() => users.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("closures_consultancy_idx").on(table.consultancyId)]
);

/**
 * `authorised_exception`: lets closure proceed with an unpaid balance only
 * when explicitly authorised (Phase 10 financial exception path).
 */
export const closureExceptions = pgTable(
  "closure_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    closureId: uuid("closure_id")
      .notNull()
      .references(() => closures.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    amountOutstanding: numeric("amount_outstanding", { precision: 14, scale: 2 }).notNull(),
    expectedRecoveryAction: text("expected_recovery_action").notNull(),
    authorisingOfficerId: uuid("authorising_officer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    date: date("date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("closure_exceptions_closure_idx").on(table.closureId)]
);
