import { and, eq, arrayContains } from "drizzle-orm";
import { db } from "@/db";
import type { Executor } from "@/db";
import { notifications, users } from "@/db/schema";
import type { Role } from "@/db/schema/enums";

type NotificationChannel = "portal" | "email";

/**
 * Stub delivery for non-portal channels — logs instead of actually sending,
 * per the plan's explicit "can be stubbed/logged in this phase" allowance.
 * The notification row and trigger logic are the priority, not the wire.
 */
async function deliverIfNeeded(channel: NotificationChannel, message: string) {
  if (channel === "email") {
    console.log(`[notifications] would send email: ${message}`);
  }
}

/** Notifies a single user, inserting one row they can mark read independently. */
export async function notifyUser(
  input: { userId: string; consultancyId?: string | null; type: string; message: string; channel?: NotificationChannel },
  executor: Executor = db
) {
  const channel = input.channel ?? "portal";
  const [row] = await executor
    .insert(notifications)
    .values({
      userId: input.userId,
      consultancyId: input.consultancyId ?? null,
      type: input.type,
      message: input.message,
      channel,
      sentAt: new Date(),
    })
    .returning();
  await deliverIfNeeded(channel, input.message);
  return row;
}

/**
 * Notifies every user holding `role` — resolved to individual user rows (not
 * one shared row) so each recipient can mark their own copy read. When
 * `departmentId` is given, only department-scoped roles (`hod`) are narrowed
 * to that department; org-wide roles (`iiic_admin`, `finance`,
 * `competent_authority`, `system_admin`, `audit_readonly`) ignore it.
 */
export async function notifyRole(
  input: {
    role: Role;
    departmentId?: string | null;
    consultancyId?: string | null;
    type: string;
    message: string;
    channel?: NotificationChannel;
  },
  executor: Executor = db
) {
  const scopeToDepartment = input.role === "hod" && input.departmentId;
  const recipients = await executor
    .select({ id: users.id })
    .from(users)
    .where(
      scopeToDepartment
        ? and(arrayContains(users.roles, [input.role]), eq(users.departmentId, input.departmentId!))
        : arrayContains(users.roles, [input.role])
    );

  const channel = input.channel ?? "portal";
  const rows = await Promise.all(
    recipients.map((r) =>
      executor
        .insert(notifications)
        .values({
          userId: r.id,
          role: input.role,
          consultancyId: input.consultancyId ?? null,
          type: input.type,
          message: input.message,
          channel,
          sentAt: new Date(),
        })
        .returning()
    )
  );
  await deliverIfNeeded(channel, input.message);
  return rows.flat();
}
