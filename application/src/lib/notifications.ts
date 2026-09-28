import { and, eq, arrayContains, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import type { Executor } from "@/db";
import { notifications, users } from "@/db/schema";
import type { Role } from "@/db/schema/enums";
import { emailNotificationsEnabled, sendNotificationEmail } from "./email";

type NotificationChannel = "portal" | "email";

function subjectFor(type: string): string {
  const readable = type.replace(/_/g, " ");
  return `CAIAS Consultancy Portal — ${readable.charAt(0).toUpperCase()}${readable.slice(1)}`;
}

/**
 * Official-email copy of a notification (spec §60), when the email channel
 * is switched on. Fire-and-forget: it never delays or fails the action that
 * raised it, and the portal notification row is the record of delivery.
 *
 * Most notifications are raised inside a route's transaction, so the mail is
 * held until the notification row is visible outside it (i.e. committed) —
 * an action that rolls back after notifying must not email anyone.
 */
async function emailCopies(
  executor: Executor,
  rows: { id: string; userId: string | null }[],
  input: { type: string; message: string; consultancyId?: string | null }
) {
  if (!emailNotificationsEnabled() || rows.length === 0) return;
  const recipients = await executor
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.id, rows.map((r) => r.userId).filter((id): id is string => Boolean(id))));
  if (recipients.length === 0) return;

  const portalUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  const link = portalUrl ? (input.consultancyId ? `${portalUrl}/consultancies/${input.consultancyId}` : portalUrl) : "";
  const text = `${input.message}${link ? `

Open in the CAIAS Consultancy Portal: ${link}` : ""}`;

  void (async () => {
    if (executor !== db && !(await committed(rows[0].id))) return;
    for (const { email } of recipients) {
      if (email) await sendNotificationEmail({ to: email, subject: subjectFor(input.type), text });
    }
  })();
}

/** Waits (up to ~15s) for a notification row inserted in a transaction to be committed. */
async function committed(notificationId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const [row] = await db.select({ id: notifications.id }).from(notifications).where(eq(notifications.id, notificationId));
    if (row) return true;
  }
  return false;
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
  await emailCopies(executor, [row], input);
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
  const scopeToDepartment = input.role === "hod" && Boolean(input.departmentId);
  const recipients = await executor
    .select({ id: users.id })
    .from(users)
    .where(
      scopeToDepartment
        ? and(sql`${input.role}::role = ANY(${users.roles})`, eq(users.departmentId, input.departmentId!))
        : sql`${input.role}::role = ANY(${users.roles})`
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
  const inserted = rows.flat();
  await emailCopies(executor, inserted, input);
  return inserted;
}
