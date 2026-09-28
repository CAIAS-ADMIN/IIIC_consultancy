import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { auditEvents, users } from "@/db/schema";
import type { Executor } from "@/db";

/** Client IP + user agent of the current request, or nulls outside a request (scripts, background jobs). */
async function requestContext(): Promise<{ requestIp: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    return {
      requestIp: (forwarded || h.get("x-real-ip") || null)?.slice(0, 64) ?? null,
      userAgent: h.get("user-agent")?.slice(0, 512) ?? null,
    };
  } catch {
    return { requestIp: null, userAgent: null };
  }
}

export async function recordAuditEvent(
  input: {
    consultancyId?: string | null;
    entityType: string;
    entityId: string;
    action: string;
    actorId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    comments?: string | null;
  },
  executor: Executor = db
) {
  const [context, actor] = await Promise.all([
    requestContext(),
    input.actorId ? executor.query.users.findFirst({ where: eq(users.id, input.actorId), columns: { roles: true } }) : null,
  ]);
  await executor.insert(auditEvents).values({
    consultancyId: input.consultancyId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actorId: input.actorId ?? null,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    comments: input.comments ?? null,
    actorRoles: actor?.roles ?? null,
    requestIp: context.requestIp,
    userAgent: context.userAgent,
  });
}
