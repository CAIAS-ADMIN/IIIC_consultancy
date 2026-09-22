import { pgTable, uuid, varchar, integer, numeric, date, timestamp, index } from "drizzle-orm/pg-core";
import { consultancies } from "./consultancies";

/**
 * agreement_type, payment_terms and payment_mode are admin-editable
 * master_data codes (category "agreement_type" / "payment_terms" /
 * "payment_mode"), not Postgres enums — consistent with
 * organization_type/consultancy_area and the spec's "master values should be
 * configurable by authorized administrators" principle.
 */
export const agreements = pgTable(
  "agreements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    agreementTypeCode: varchar("agreement_type_code", { length: 100 }).notNull(),
    agreementTypeOther: varchar("agreement_type_other", { length: 255 }),
    agreementNumber: varchar("agreement_number", { length: 100 }),
    agreementDate: date("agreement_date"),
    agreementStartDate: date("agreement_start_date"),
    agreementEndDate: date("agreement_end_date"),
    agreementValue: numeric("agreement_value", { precision: 14, scale: 2 }).notNull(),
    paymentTermsCode: varchar("payment_terms_code", { length: 100 }).notNull(),
    paymentTermsOther: varchar("payment_terms_other", { length: 255 }),
    paymentModeCode: varchar("payment_mode_code", { length: 100 }),
    paymentModeOther: varchar("payment_mode_other", { length: 255 }),
    numberOfInstallments: integer("number_of_installments"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("agreements_consultancy_idx").on(table.consultancyId)]
);
