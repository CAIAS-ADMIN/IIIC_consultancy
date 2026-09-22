import { pgTable, uuid, varchar, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { consultancies } from "./consultancies";
import { users } from "./users";
import { roleEnum, notificationChannelEnum } from "./enums";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role"),
    consultancyId: uuid("consultancy_id").references(() => consultancies.id, {
      onDelete: "cascade",
    }),
    type: varchar("type", { length: 100 }).notNull(),
    message: text("message").notNull(),
    channel: notificationChannelEnum("channel").notNull().default("portal"),
    isRead: boolean("is_read").notNull().default(false),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_user_idx").on(table.userId),
    index("notifications_consultancy_idx").on(table.consultancyId),
  ]
);
