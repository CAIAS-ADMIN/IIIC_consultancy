import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { consultancies } from "./consultancies";

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    organizationName: varchar("organization_name", { length: 255 }).notNull(),
    organizationTypeCode: varchar("organization_type_code", { length: 100 }).notNull(),
    organizationTypeOther: varchar("organization_type_other", { length: 255 }),
    industrySectorCode: varchar("industry_sector_code", { length: 100 }),
    contactPersonName: varchar("contact_person_name", { length: 255 }),
    designation: varchar("designation", { length: 255 }),
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 50 }),
    address: text("address"),
    website: varchar("website", { length: 500 }),
    countryCode: varchar("country_code", { length: 100 }),
    stateCode: varchar("state_code", { length: 100 }),
    cityCode: varchar("city_code", { length: 100 }),
    gstin: varchar("gstin", { length: 20 }),
    pan: varchar("pan", { length: 20 }),
    pinCode: varchar("pin_code", { length: 20 }),
    contactDepartment: varchar("contact_department", { length: 255 }),
    alternateContactName: varchar("alternate_contact_name", { length: 255 }),
    alternateContactEmail: varchar("alternate_contact_email", { length: 255 }),
    alternateContactPhone: varchar("alternate_contact_phone", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("clients_consultancy_idx").on(table.consultancyId)]
);
