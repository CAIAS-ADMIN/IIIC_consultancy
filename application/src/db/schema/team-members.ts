import { pgTable, uuid, varchar, boolean, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { consultancies } from "./consultancies";
import { users } from "./users";

export const consultancyTeamMembers = pgTable(
  "consultancy_team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: varchar("name", { length: 255 }).notNull(),
    role: varchar("role", { length: 100 }).notNull(),
    roleOther: varchar("role_other", { length: 255 }),
    department: varchar("department", { length: 255 }),
    isExternal: boolean("is_external").notNull().default(false),
    employeeId: varchar("employee_id", { length: 50 }),
    designation: varchar("designation", { length: 255 }),
    estimatedHours: numeric("estimated_hours", { precision: 8, scale: 2 }),
    contributionPercent: numeric("contribution_percent", { precision: 5, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("team_members_consultancy_idx").on(table.consultancyId)]
);
