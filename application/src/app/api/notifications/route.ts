import { and, desc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { notifications } from "@/db/schema";

const LIST_LIMIT = 50;

/**
 * GET /api/notifications — the current user's own notification rows,
 * newest first, plus the real unread count. Every notification row already
 * has a concrete `userId` (both `notifyUser` and `notifyRole` resolve to
 * individual recipients at write time — `role` on the row is just display
 * context), so this is a plain `WHERE userId = me`, no role-matching needed.
 */
export async function GET() {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const [rows, unread] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(LIST_LIMIT),
    db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false))),
  ]);

  return Response.json({ data: rows, unreadCount: unread.length });
}
