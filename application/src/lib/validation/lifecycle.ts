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
