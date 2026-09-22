import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const money = z.union([z.number(), z.string()]).transform((v) => String(v));

export const requestClosureSchema = z
  .object({
    actualCompletionDate: dateString,
    deliverableCompletionStatus: z.enum(["yes", "partially", "no"]),
    partialReason: z.string().optional(),
    finalOutcomes: z.string().min(1),
    finalReportDocumentId: z.string().uuid(),
  })
  .superRefine((val, ctx) => {
    if (val.deliverableCompletionStatus === "partially" && !val.partialReason) {
      ctx.addIssue({ code: "custom", path: ["partialReason"], message: "Required when deliverable completion is Partially" });
    }
  });

export const closureExceptionSchema = z.object({
  reason: z.string().min(1),
  amountOutstanding: money,
  expectedRecoveryAction: z.string().min(1),
  date: dateString,
});

export const verifyClosureSchema = z.object({
  decision: z.enum(["verified", "clarification_required", "returned"]),
  comments: z.string().optional(),
});

export const recordClientAcceptanceSchema = z.object({
  acceptedByName: z.string().min(1).max(255),
  acceptanceDate: dateString,
  documentId: z.string().uuid().optional(),
  remarks: z.string().optional(),
});
