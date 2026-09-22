import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { consultancies } from "./consultancies";
import { users } from "./users";
import { approvalDecisionEnum } from "./enums";

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultancyId: uuid("consultancy_id")
      .notNull()
      .references(() => consultancies.id, { onDelete: "restrict" }),
    stage: varchar("stage", { length: 100 }).notNull(),
    decision: approvalDecisionEnum("decision").notNull(),
    decidedBy: uuid("decided_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    comments: text("comments"),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("approvals_consultancy_idx").on(table.consultancyId)]
);
