import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const money = z.union([z.number(), z.string()]).transform((v) => String(v));

/** Screen 24 — Final Outcome */
export const FINAL_OUTCOME_OPTIONS = [
  { code: "completed_successfully", label: "Consultancy completed successfully" },
  { code: "partially_completed", label: "Consultancy partially completed" },
  { code: "terminated", label: "Consultancy terminated" },
  { code: "cancelled", label: "Consultancy cancelled" },
] as const;

/** Screen 25 — Consultant Declaration; every box must be ticked. */
export const CLOSURE_DECLARATION_ITEMS = [
  { key: "activitiesCompleted", text: "I confirm that the consultancy activities recorded in this portal have been completed as stated." },
  { key: "deliverablesRecorded", text: "All agreed deliverables have been submitted or their status has been recorded." },
  { key: "documentsUploaded", text: "All relevant consultancy documents have been uploaded." },
  { key: "financialsReported", text: "Financial details have been accurately reported." },
  { key: "informationTrue", text: "The information provided is true and complete." },
] as const;

type ClosureDeclarationKey = (typeof CLOSURE_DECLARATION_ITEMS)[number]["key"];

const deliverableOutcomeSchema = z.object({
  deliverableId: z.string().uuid(),
  completed: z.enum(["yes", "partially", "no"]),
  completionDate: dateString.optional(),
  evidenceDocumentId: z.string().uuid().optional(),
  remarks: z.string().optional(),
});

export const requestClosureSchema = z
  .object({
    actualCompletionDate: dateString,
    finalProgressPercent: z.number().int().min(0).max(100),
    deliverableCompletionStatus: z.enum(["yes", "partially", "no"]),
    partialReason: z.string().optional(),
    deliverableOutcomes: z.array(deliverableOutcomeSchema).optional().default([]),
    finalOutcomes: z.string().min(1),
    finalOutcome: z.enum(["completed_successfully", "partially_completed", "terminated", "cancelled"]),
    outcomeReason: z.string().optional(),
    fullPaymentReceived: z.boolean(),
    amountPending: money.optional(),
    pendingReason: z.string().optional(),
    expectedPaymentDate: dateString.optional(),
    finalReportDocumentId: z.string().uuid(),
    declaration: z.object(
      Object.fromEntries(
        CLOSURE_DECLARATION_ITEMS.map((item) => [item.key, z.literal(true, { error: "This confirmation is required" })])
      ) as Record<ClosureDeclarationKey, z.ZodLiteral<true>>
    ),
  })
  .superRefine((val, ctx) => {
    if (val.deliverableCompletionStatus !== "yes" && !val.partialReason) {
      ctx.addIssue({ code: "custom", path: ["partialReason"], message: "Explain why not all deliverables were completed" });
    }
    if ((val.finalOutcome === "terminated" || val.finalOutcome === "cancelled") && !val.outcomeReason) {
      ctx.addIssue({ code: "custom", path: ["outcomeReason"], message: "Reason is mandatory for a terminated or cancelled consultancy" });
    }
    if (!val.fullPaymentReceived) {
      if (!val.amountPending || !(Number(val.amountPending) > 0)) {
        ctx.addIssue({ code: "custom", path: ["amountPending"], message: "Enter the amount still pending" });
      }
      if (!val.pendingReason) ctx.addIssue({ code: "custom", path: ["pendingReason"], message: "Reason is required when payment is pending" });
      if (!val.expectedPaymentDate) {
        ctx.addIssue({ code: "custom", path: ["expectedPaymentDate"], message: "Expected payment date is required" });
      }
    }
    for (const [i, d] of val.deliverableOutcomes.entries()) {
      if (d.completed !== "no" && !d.completionDate) {
        ctx.addIssue({ code: "custom", path: ["deliverableOutcomes", i, "completionDate"], message: "Completion date is required" });
      }
    }
  });

/** Screen 23 — Finance confirms the financial position of a closure request. */
export const financeClosureVerificationSchema = z
  .object({
    status: z.enum(["verified", "discrepancy"]),
    remarks: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.status === "discrepancy" && !val.remarks) {
      ctx.addIssue({ code: "custom", path: ["remarks"], message: "Describe the discrepancy" });
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

/** Screen 22 — Client Acceptance: Yes / No / Not Required. */
export const recordClientAcceptanceSchema = z
  .object({
    acceptanceStatus: z.enum(["yes", "no", "not_required"]).default("yes"),
    acceptedByName: z.string().max(255).optional(),
    acceptanceDate: dateString.optional(),
    documentId: z.string().uuid().optional(),
    remarks: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.acceptanceStatus === "yes") {
      if (!val.acceptedByName) ctx.addIssue({ code: "custom", path: ["acceptedByName"], message: "Client representative is required" });
      if (!val.acceptanceDate) ctx.addIssue({ code: "custom", path: ["acceptanceDate"], message: "Acceptance date is required" });
    }
  });

/** Screen 22 — Client Feedback (rating optional 1–5). */
export const clientFeedbackSchema = z
  .object({
    feedbackDate: dateString,
    rating: z.number().int().min(1).max(5).optional(),
    comments: z.string().optional(),
    suggestions: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.rating === undefined && !val.comments && !val.suggestions) {
      ctx.addIssue({ code: "custom", path: ["comments"], message: "Give a rating, comments or suggestions" });
    }
  });

export const RATING_LABELS: Record<number, string> = { 1: "Poor", 2: "Fair", 3: "Good", 4: "Very Good", 5: "Excellent" };
