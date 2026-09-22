import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const createMilestoneSchema = z.object({
  title: z.string().min(1).max(255),
  plannedDate: dateString,
  deliverableId: z.string().uuid().optional(),
  responsibleConsultantId: z.string().uuid().optional(),
});

export const updateMilestoneSchema = z.object({
  actualDate: dateString.optional(),
  status: z.enum(["not_started", "in_progress", "completed", "delayed", "on_hold", "cancelled"]).optional(),
  responsibleConsultantId: z.string().uuid().optional(),
  remarks: z.string().optional(),
  evidenceDocumentId: z.string().uuid().optional(),
});

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
