import { z } from "zod";

/** Shared by POST (all fields required via `.required()`) and PATCH (any subset). Codes are stored upper-case. */
export const departmentInputSchema = z.object({
  name: z.string().trim().min(1, "Department name is required").max(255, "Department name is too long").optional(),
  code: z
    .string()
    .trim()
    .min(1, "Department code is required")
    .max(50, "Department code is too long")
    .transform((c) => c.toUpperCase())
    .optional(),
  isActive: z.boolean().optional(),
});
