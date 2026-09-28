import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const requestExtensionSchema = z.object({
  proposedCompletionDate: dateString,
  reason: z.string().min(1),
  revisedTimeline: z.string().optional(),
  clientConsent: z.boolean().default(false),
  supportingDocumentId: z.string().uuid().optional(),
});

export const decideExtensionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  comments: z.string().optional(),
});

export const putOnHoldSchema = z.object({
  reason: z.string().min(1),
  startDate: dateString,
  expectedResumeDate: dateString.optional(),
});

/** Section 51.3 — explicit reopening of a rejected or closed record. */
export const reopenConsultancySchema = z.object({
  reason: z.string().trim().min(1, "A reason is required to reopen a record"),
  supportingDocumentId: z.string().uuid().optional(),
});

/** Section 68 — logical archiving of a finished record. */
export const archiveConsultancySchema = z.object({
  reason: z.string().trim().min(1, "A reason is required"),
});

/** Statuses a record must be in before it can be archived. */
export const ARCHIVABLE_STATUSES = ["completed_closed", "cancelled", "terminated", "rejected"] as const;

export const cancelConsultancySchema = z.object({
  reason: z.string().min(1),
  date: dateString,
  financialStatus: z.string().min(1),
  outstandingObligations: z.string().optional(),
});

export const terminateConsultancySchema = z.object({
  reason: z.string().min(1),
  actualTerminationDate: dateString,
  completedDeliverables: z.string().optional(),
  outstandingDeliverables: z.string().optional(),
  financialStatus: z.string().min(1),
  clientCommunication: z.string().optional(),
});

/** Statuses an admin can send a submitted registration back to draft from — anything before it is registered. */
export const SEND_BACK_STATUSES = ["submitted", "under_verification", "clarification_required"] as const;

/** CAIAS admin "send back for re-edit" — returns a submitted registration to draft. */
export const sendBackConsultancySchema = z.object({
  reason: z.string().trim().min(1, "A reason is required to send a registration back"),
});
