import { getTableColumns } from "drizzle-orm";
import { consultancies } from "@/db/schema";

/**
 * System/lifecycle columns a reviewer should never be able to flag for
 * clarification — everything else on `consultancies` is a real field the
 * faculty actually filled in at registration, and `PATCH /:id` (the
 * clarification-edit branch) will accept any of them once flagged.
 */
const EXCLUDED_FIELDS = new Set<string>([
  "id",
  "consultancyCode",
  "status",
  "workflowStage",
  "currentVersion",
  "isLocked",
  "flaggedFields",
  "submittedAt",
  "registeredAt",
  "activatedAt",
  "activatedBy",
  "declarationAcceptedAt",
  "declarationAcceptedBy",
  "archivedAt",
  "archivedBy",
  "archiveReason",
  "createdBy",
  "createdAt",
  "updatedAt",
]);

/** "totalValue" -> "Total Value" */
function humanizeFieldName(field: string): string {
  return field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * The single source of truth for "which top-level consultancy fields can be
 * flagged for clarification" — derived from the real table schema (not
 * hand-maintained in two places), used both by the Return-for-Clarification
 * picker (Phase 5) and to validate `flaggedFields` server-side on return.
 */
export const FLAGGABLE_FIELDS: { field: string; label: string }[] = Object.keys(getTableColumns(consultancies))
  .filter((field) => !EXCLUDED_FIELDS.has(field))
  .map((field) => ({ field, label: humanizeFieldName(field) }))
  .sort((a, b) => a.label.localeCompare(b.label));

export const FLAGGABLE_FIELD_NAMES = new Set(FLAGGABLE_FIELDS.map((f) => f.field));
