import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { notifications } from "@/db/schema";

/** PATCH /api/notifications/:id — marks one of the caller's own notifications read (isRead only; nothing else is user-editable). */
export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const existing = await db.query.notifications.findFirst({ where: eq(notifications.id, id) });
  if (!existing || existing.userId !== user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [updated] = await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id)).returning();
  return Response.json({ data: updated });
}
