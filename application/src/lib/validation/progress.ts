import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const addProgressUpdateSchema = z
  .object({
    reportDate: dateString,
    reportingPeriodStart: dateString,
    reportingPeriodEnd: dateString,
    status: z.enum(["on_track", "delayed", "on_hold", "completed"]),
    // Screen 17 — Work Completed / Work in Progress are mandatory; the rest optional.
    workCompleted: z.string().trim().min(1, "Work Completed is required"),
    workInProgress: z.string().trim().min(1, "Work in Progress is required"),
    pendingActivities: z.string().optional(),
    challenges: z.string().optional(),
    correctiveAction: z.string().optional(),
    nextPlannedActivity: z.string().optional(),
    overallProgressPercent: z.number().int().min(0).max(100),
    documentIds: z.array(z.string().uuid()).optional().default([]),
  })
  .superRefine((val, ctx) => {
    if (val.reportingPeriodEnd < val.reportingPeriodStart) {
      ctx.addIssue({
        code: "custom",
        path: ["reportingPeriodEnd"],
        message: "Reporting period end cannot precede its start",
      });
    }
  });

export type AddProgressUpdateInput = z.infer<typeof addProgressUpdateSchema>;
