import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import type { Executor } from "@/db";

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
  await executor.insert(auditEvents).values({
    consultancyId: input.consultancyId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actorId: input.actorId ?? null,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    comments: input.comments ?? null,
  });
}
