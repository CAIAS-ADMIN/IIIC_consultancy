import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { departments } from "./departments";

/**
 * Generic, admin-editable dropdown/config values: consultancy areas, industries,
 * organization types, agreement types, payment terms, academic years, document
 * types, etc. `category` discriminates the dropdown group.
 */
export const masterData = pgTable(
  "master_data",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: varchar("category", { length: 100 }).notNull(),
    code: varchar("code", { length: 100 }).notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    metadata: jsonb("metadata"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("master_data_category_code_idx").on(table.category, table.code)]
);

/**
 * Approval-stage configuration: which workflow stages are required, read at
 * runtime instead of hardcoding which roles approve. A null department/area
 * means "applies to all". Rows are matched by (department, consultancy area,
 * value range) and ordered by `sequence`.
 */
export const approvalStageConfigs = pgTable("approval_stage_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "cascade" }),
  consultancyAreaCode: varchar("consultancy_area_code", { length: 100 }),
  minValue: numeric("min_value", { precision: 14, scale: 2 }),
  maxValue: numeric("max_value", { precision: 14, scale: 2 }),
  stage: varchar("stage", { length: 100 }).notNull(),
  sequence: integer("sequence").notNull(),
  isRequired: boolean("is_required").notNull().default(true),
  approverRole: varchar("approver_role", { length: 50 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
