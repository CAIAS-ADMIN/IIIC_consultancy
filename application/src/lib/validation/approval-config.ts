import { z } from "zod";

/** Who manages approval configuration (spec §50: "The CAIAS administrator should be able to configure…"). */
export const APPROVAL_CONFIG_ROLES = ["iiic_admin", "system_admin"] as const;

/** The workflow stages a configuration row can require (Section 44.1), in routing order. */
export const APPROVAL_STAGES = [
  { code: "hod_verification_pending", label: "HOD Verification", defaultRole: "hod" },
  { code: "caias_verification_pending", label: "CAIAS Verification", defaultRole: "iiic_admin" },
  { code: "competent_authority_approval_pending", label: "Competent Authority Approval", defaultRole: "competent_authority" },
] as const;

export const APPROVER_ROLES = [
  { code: "hod", label: "HOD" },
  { code: "iiic_admin", label: "CAIAS Consultancy Administrator" },
  { code: "competent_authority", label: "Principal / Competent Authority" },
] as const;

const optionalMoney = z
  .union([z.number(), z.string()])
  .transform((v) => (v === "" ? null : String(v)))
  .nullable()
  .optional();

/** Section 50 — one approval-stage rule. Null/absent conditions mean "applies to all". */
export const approvalConfigSchema = z
  .object({
    stage: z.enum(["hod_verification_pending", "caias_verification_pending", "competent_authority_approval_pending"]),
    approverRole: z.enum(["hod", "iiic_admin", "competent_authority"]),
    sequence: z.number().int().min(1).max(99),
    isRequired: z.boolean().default(true),
    departmentId: z.string().uuid().nullable().optional(),
    consultancyAreaCode: z.string().min(1).nullable().optional(),
    consultancyCategoryCode: z.string().min(1).nullable().optional(),
    minValue: optionalMoney,
    maxValue: optionalMoney,
    whenResourcesUsed: z.boolean().nullable().optional(),
    whenIpOrConfidential: z.boolean().nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.minValue != null && val.maxValue != null && Number(val.maxValue) < Number(val.minValue)) {
      ctx.addIssue({ code: "custom", path: ["maxValue"], message: "Maximum value cannot be below the minimum" });
    }
  });

export type ApprovalConfigInput = z.infer<typeof approvalConfigSchema>;
