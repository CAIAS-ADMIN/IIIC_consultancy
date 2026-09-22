import { pgTable, uuid, text, integer, date, timestamp, index } from "drizzle-orm/pg-core";
import { consultancies } from "./consultancies";
import { users } from "./users";
import { progressStatusEnum } from "./enums";

export const progressUpdates = pgTable(
  "progress_updates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    reportDate: date("report_date").notNull(),
    reportingPeriodStart: date("reporting_period_start").notNull(),
    reportingPeriodEnd: date("reporting_period_end").notNull(),
    status: progressStatusEnum("status").notNull(),
    workCompleted: text("work_completed"),
    workInProgress: text("work_in_progress"),
    overallProgressPercent: integer("overall_progress_percent").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("progress_updates_consultancy_idx").on(table.consultancyId)]
);
