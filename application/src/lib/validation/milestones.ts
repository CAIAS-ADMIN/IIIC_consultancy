import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/** Screen 9 / 18 — a milestone added once the consultancy is active. */
export const createMilestoneSchema = z
  .object({
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    startDate: dateString.optional(),
    plannedDate: dateString,
    deliverableId: z.string().uuid().optional(),
    responsibleConsultantId: z.string().uuid().optional(),
    responsiblePerson: z.string().max(255).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.startDate && val.plannedDate < val.startDate) {
      ctx.addIssue({ code: "custom", path: ["plannedDate"], message: "Expected completion cannot precede the milestone start" });
    }
  });

/** Screen 18 — Milestone Update: actual start/completion, status, remarks, evidence. */
export const updateMilestoneSchema = z
  .object({
    actualStartDate: dateString.optional(),
    actualDate: dateString.optional(),
    status: z.enum(["not_started", "in_progress", "completed", "delayed", "on_hold", "cancelled"]).optional(),
    responsibleConsultantId: z.string().uuid().optional(),
    remarks: z.string().optional(),
    evidenceDocumentId: z.string().uuid().optional(),
  })
  .superRefine((val, ctx) => {
    // Section 47.1 — milestone completion cannot precede milestone start.
    if (val.actualStartDate && val.actualDate && val.actualDate < val.actualStartDate) {
      ctx.addIssue({ code: "custom", path: ["actualDate"], message: "Actual completion cannot precede the actual start" });
    }
  });

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
