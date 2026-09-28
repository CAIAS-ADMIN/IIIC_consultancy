import type { NextRequest } from "next/server";
import { and, count, desc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { notifications } from "@/db/schema";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function intParam(value: string | null, fallback: number, max: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : fallback;
}

/**
 * GET /api/notifications — the current user's own notification rows,
 * newest first, plus the real unread count. Every notification row already
 * has a concrete `userId` (both `notifyUser` and `notifyRole` resolve to
 * individual recipients at write time — `role` on the row is just display
 * context), so this is a plain `WHERE userId = me`, no role-matching needed.
 *
 * Paged with `?limit=` (max 50) and `?offset=`; `hasMore` tells the panel
 * whether to offer "Load more".
 */
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const limit = Math.max(1, intParam(request.nextUrl.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT));
  const offset = intParam(request.nextUrl.searchParams.get("offset"), 0, Number.MAX_SAFE_INTEGER);

  const [rows, [unread]] = await Promise.all([
    // One extra row tells us whether another page exists without a second count query.
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit + 1)
      .offset(offset),
    db
      .select({ total: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false))),
  ]);

  return Response.json({ data: rows.slice(0, limit), hasMore: rows.length > limit, unreadCount: unread.total });
}

/** PATCH /api/notifications — marks all notifications for the current user as read. */
export async function PATCH(_request: NextRequest) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));

  return Response.json({ success: true });
}

