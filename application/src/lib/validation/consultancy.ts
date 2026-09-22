import { z } from "zod";

const yesNo = z.boolean();
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const money = z.union([z.number(), z.string()]).transform((v) => String(v));

/** Section 2/3 — Registration / Basic Details + Consultancy Area. Draft-level: only what's needed to create the row. */
export const draftConsultancySchema = z.object({
  departmentId: z.string().uuid(),
  departmentCoordinatorId: z.string().uuid().optional(),
  academicYearCode: z.string().min(1),
  consultancyTypeCode: z.string().min(1),
  teamTypeCode: z.string().min(1),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  consultancyAreaCode: z.string().min(1),
  consultancyAreaOther: z.string().optional(),
});

/** Section 4 — Client / External Organization */
const clientSchema = z
  .object({
    organizationName: z.string().min(1),
    organizationTypeCode: z.string().min(1),
    organizationTypeOther: z.string().optional(),
    industrySectorCode: z.string().optional(),
    contactPersonName: z.string().optional(),
    designation: z.string().optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    address: z.string().optional(),
    website: z.string().url().optional(),
    countryCode: z.string().optional(),
    stateCode: z.string().optional(),
    cityCode: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.organizationTypeCode === "other" && !val.organizationTypeOther) {
      ctx.addIssue({
        code: "custom",
        path: ["organizationTypeOther"],
        message: "Required when Organization Type is Other",
      });
    }
  });

/** Section 5 — MoU / Agreement Details */
const agreementSchema = z
  .object({
    agreementTypeCode: z.string().min(1),
    agreementTypeOther: z.string().optional(),
    agreementNumber: z.string().optional(),
    agreementDate: dateString.optional(),
    agreementStartDate: dateString.optional(),
    agreementEndDate: dateString.optional(),
    agreementValue: money,
    paymentTermsCode: z.string().min(1),
    paymentTermsOther: z.string().optional(),
    paymentModeCode: z.string().optional(),
    paymentModeOther: z.string().optional(),
    numberOfInstallments: z.number().int().positive().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.agreementTypeCode === "other" && !val.agreementTypeOther) {
      ctx.addIssue({ code: "custom", path: ["agreementTypeOther"], message: "Required when Agreement Type is Other" });
    }
    if (val.paymentTermsCode === "other" && !val.paymentTermsOther) {
      ctx.addIssue({ code: "custom", path: ["paymentTermsOther"], message: "Required when Payment Terms is Other" });
    }
    if (val.paymentModeCode === "other" && !val.paymentModeOther) {
      ctx.addIssue({ code: "custom", path: ["paymentModeOther"], message: "Required when Payment Mode is Other" });
    }
  });

/** Section 6 — Consultancy Team */
const teamMemberSchema = z.object({
  userId: z.string().uuid().optional(),
  name: z.string().min(1),
  role: z.string().min(1),
  department: z.string().optional(),
  isExternal: z.boolean().optional().default(false),
});

const teamSchema = z
  .object({
    members: z.array(teamMemberSchema).min(1, "At least one team member is required"),
    departmentsInvolved: z.array(z.string().uuid()).optional().default([]),
    externalExpertInvolved: yesNo.default(false),
    externalExpertDetails: z.string().optional(),
    rolesAndResponsibilities: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.externalExpertInvolved && !val.externalExpertDetails) {
      ctx.addIssue({
        code: "custom",
        path: ["externalExpertDetails"],
        message: "Required when External Expert Involved is Yes",
      });
    }
  });

/** Section 7 — Financial Details */
const financialSchema = z
  .object({
    totalValue: money,
    currencyCode: z.string().min(1).default("INR"),
    taxApplicable: yesNo.default(false),
    taxDetails: z.string().optional(),
    estimatedInstitutionalCosts: money.optional(),
    otherApprovedCosts: money.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.taxApplicable && !val.taxDetails) {
      ctx.addIssue({ code: "custom", path: ["taxDetails"], message: "Required when Tax Applicable is Yes" });
    }
  });

/** Section 8 — Scope of Work & Deliverables */
const deliverableSchema = z.object({
  description: z.string().min(1),
  dueDate: dateString.optional(),
});

const scopeSchema = z.object({
  scopeOfWork: z.string().min(1),
  expectedOutcomes: z.string().optional(),
  clientAcceptanceRequired: yesNo.default(false),
  deliverables: z.array(deliverableSchema).min(1, "At least one deliverable is required"),
});

/** Section 5 conditional flags (NDA / IP) + Section 10 — CAIAS Resources */
const resourcesSchema = z
  .object({
    ndaRequired: yesNo.default(false),
    ipAgreementRequired: yesNo.default(false),
    caiasResourcesRequired: yesNo.default(false),
    laboratoryRequired: yesNo.default(false),
    equipmentRequired: yesNo.default(false),
    softwareRequired: yesNo.default(false),
    travelRequired: yesNo.default(false),
    externalExpertRequired: yesNo.default(false),
    resourceDetails: z.string().optional(),
    estimatedResourceCost: money.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.caiasResourcesRequired && !val.resourceDetails) {
      ctx.addIssue({
        code: "custom",
        path: ["resourceDetails"],
        message: "Required when CAIAS Resources Required is Yes",
      });
    }
  });

/** Full submission payload — all sections required, cross-field rules enforced. */
export const submitConsultancySchema = z
  .object({
    consultancy: draftConsultancySchema.extend({
      startDate: dateString,
      expectedCompletionDate: dateString,
    }),
    client: clientSchema,
    agreement: agreementSchema,
    team: teamSchema,
    financial: financialSchema,
    scope: scopeSchema,
    resources: resourcesSchema,
  })
  .superRefine((val, ctx) => {
    if (val.consultancy.consultancyAreaCode === "other" && !val.consultancy.consultancyAreaOther) {
      ctx.addIssue({
        code: "custom",
        path: ["consultancy", "consultancyAreaOther"],
        message: "Required when Consultancy Area is Other",
      });
    }
    if (val.consultancy.expectedCompletionDate < val.consultancy.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["consultancy", "expectedCompletionDate"],
        message: "Expected Completion Date cannot precede Start Date",
      });
    }
  });

export type SubmitConsultancyInput = z.infer<typeof submitConsultancySchema>;
export type DraftConsultancyInput = z.infer<typeof draftConsultancySchema>;
