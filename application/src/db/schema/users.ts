import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { roleEnum } from "./enums";
import { departments } from "./departments";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    keycloakSub: varchar("keycloak_sub", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    employeeId: varchar("employee_id", { length: 50 }),
    phone: varchar("phone", { length: 30 }),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    roles: roleEnum("roles").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("users_keycloak_sub_idx").on(table.keycloakSub),
    uniqueIndex("users_email_idx").on(table.email),
  ]
);
