import { getTableColumns, type Table } from "drizzle-orm";
import {
  agreements,
  clients,
  consultancyTeamMembers,
  deliverables,
  paymentSchedules,
} from "@/db/schema";
import { FLAGGABLE_FIELD_NAMES } from "./flaggable-fields";

/**
 * Consultancy columns a draft save may write: every user-entered field
 * (the same set a reviewer can flag), minus completion dates that only the
 * lifecycle sets. Anything else in the request body — `status`,
 * `workflowStage`, `consultancyCode`, `isLocked`… — is dropped, so a draft
 * can't be pushed past verification by a crafted PATCH.
 */
const DRAFT_CONSULTANCY_FIELDS = new Set(
  [...FLAGGABLE_FIELD_NAMES].filter((f) => f !== "currentCompletionDate" && f !== "actualCompletionDate")
);

const ROW_SYSTEM_FIELDS = new Set(["id", "consultancyId", "createdAt", "updatedAt"]);

function pick(source: Record<string, unknown>, allowed: (key: string) => boolean): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([key]) => allowed(key)));
}

function columnPicker(table: Table, extraExcluded: string[] = []) {
  const allowed = new Set(Object.keys(getTableColumns(table)).filter((k) => !ROW_SYSTEM_FIELDS.has(k) && !extraExcluded.includes(k)));
  return (row: unknown) => pick((row ?? {}) as Record<string, unknown>, (k) => allowed.has(k));
}

export const pickDraftConsultancyFields = (body: Record<string, unknown>) => pick(body, (k) => DRAFT_CONSULTANCY_FIELDS.has(k));
export const pickClientFields = columnPicker(clients);
export const pickAgreementFields = columnPicker(agreements);
export const pickTeamMemberFields = columnPicker(consultancyTeamMembers);
export const pickDeliverableFields = columnPicker(deliverables, ["status"]);
/** Registration-time milestone planning only — status/actuals/evidence are execution-phase fields. */
export const pickPlannedMilestoneFields = (row: unknown) => {
  const r = (row ?? {}) as Record<string, unknown>;
  return pick(r, (k) => ["title", "description", "startDate", "plannedDate", "responsiblePerson"].includes(k));
};
export const pickPaymentScheduleFields = columnPicker(paymentSchedules);
