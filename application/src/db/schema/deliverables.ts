import { pgTable, uuid, text, date, timestamp, index } from "drizzle-orm/pg-core";
import { consultancies } from "./consultancies";
import { milestoneStatusEnum } from "./enums";

export const deliverables = pgTable(
  "deliverables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    description: text("description").notNull(),
    dueDate: date("due_date"),
    status: milestoneStatusEnum("status").notNull().default("not_started"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("deliverables_consultancy_idx").on(table.consultancyId)]
);
