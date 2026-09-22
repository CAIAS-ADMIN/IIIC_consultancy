import { z } from "zod";

export const verifyStageSchema = z
  .object({
    decision: z.enum(["verify", "return", "reject"]),
    comments: z.string().optional(),
    flaggedFields: z.array(z.string().min(1)).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.decision === "return" && (!val.flaggedFields || val.flaggedFields.length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["flaggedFields"],
        message: "At least one flagged field is required when returning for clarification",
      });
    }
  });

export type VerifyStageInput = z.infer<typeof verifyStageSchema>;
