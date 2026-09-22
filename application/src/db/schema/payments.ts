import { pgTable, uuid, varchar, text, numeric, date, timestamp, index } from "drizzle-orm/pg-core";
import { consultancies } from "./consultancies";
import { users } from "./users";

export const paymentSchedules = pgTable(
  "payment_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    stageLabel: varchar("stage_label", { length: 255 }).notNull(),
    plannedAmount: numeric("planned_amount", { precision: 14, scale: 2 }).notNull(),
    plannedDate: date("planned_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("payment_schedules_consultancy_idx").on(table.consultancyId)]
);

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    transactionDate: date("transaction_date").notNull(),
    institutionalAccountRef: varchar("institutional_account_ref", { length: 255 }).notNull(),
    transactionRef: varchar("transaction_ref", { length: 255 }).notNull(),
    tdsDeducted: numeric("tds_deducted", { precision: 14, scale: 2 }).notNull().default("0"),
    remarks: text("remarks"),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("payment_transactions_consultancy_idx").on(table.consultancyId)]
);

/**
 * `authorised_adjustment`: lets total recorded payments exceed the agreement
 * value only when explicitly authorised (Phase 9 overpayment reconciliation).
 */
export const paymentAdjustments = pgTable(
  "payment_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    authorisedBy: uuid("authorised_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("payment_adjustments_consultancy_idx").on(table.consultancyId)]
);
