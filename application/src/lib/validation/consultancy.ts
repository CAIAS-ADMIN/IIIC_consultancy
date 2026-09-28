import { z } from "zod";

export const yesNo = z.boolean();
export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
export const money = z.union([z.number(), z.string()]).transform((v) => String(v));

const required = (label: string) => z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`);

/** Screen 2 — "Has an MoU / Consultancy Agreement / Work Order been signed?" */
export const AGREEMENT_SIGNED_OPTIONS = [
  { code: "mou", label: "Yes – MoU" },
  { code: "consultancy_agreement", label: "Yes – Consultancy Agreement" },
  { code: "work_order", label: "Yes – Work Order / Service Agreement" },
  { code: "no", label: "No" },
] as const;

export const AGREEMENT_NOT_SIGNED_MESSAGE =
  "Consultancy registration cannot be submitted until the applicable written agreement/engagement document is available.";

/** The team_role master-data code every submission must include (Section 47.3). */
export const PRINCIPAL_CONSULTANT_ROLE = "principal_consultant";

/** Screen 12 — "Is IP expected to be generated?" */
export const IP_EXPECTED_OPTIONS = [
  { code: "yes", label: "Yes" },
  { code: "no", label: "No" },
  { code: "not_applicable", label: "Not Applicable" },
] as const;

/** Screen 14 — every box must be ticked before submission. */
export const DECLARATION_ITEMS = [
  { key: "informationAccurate", text: "I confirm that the information provided in this registration is accurate and complete." },
  {
    key: "undertakenThroughCaias",
    text: "I confirm that the consultancy is being undertaken through CAIAS and in accordance with applicable institutional policies and guidelines.",
  },
  { key: "agreementExecuted", text: "I confirm that the consultancy agreement / applicable written engagement has been executed." },
  {
    key: "paymentsRouted",
    text: "I confirm that all consultancy payments shall be routed through the designated CAIAS institutional account.",
  },
  { key: "resourcesAsDeclared", text: "I confirm that CAIAS resources shall be used only as declared and authorised." },
] as const;

export type DeclarationKey = (typeof DECLARATION_ITEMS)[number]["key"];

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

/**
 * Creating the draft row itself: only department and academic year are
 * needed (the wizard saves right after its first screen, before a title or
 * type exists). The rest is filled in by later draft saves and enforced in
 * full at submit.
 */
export const createDraftConsultancySchema = draftConsultancySchema.partial().required({ departmentId: true, academicYearCode: true });

/** Screen 4 — Client / Industry Details. Mandatory set per the portal spec. */
export const clientSchema = z
  .object({
    organizationName: required("Organisation Name"),
    organizationTypeCode: required("Client Type"),
    organizationTypeOther: z.string().optional(),
    industrySectorCode: required("Client Industry/Sector"),
    contactPersonName: required("Contact Name"),
    designation: required("Designation"),
    contactEmail: z.string({ error: "Official Email is required" }).email("Enter a valid email"),
    contactPhone: required("Mobile Number"),
    contactDepartment: z.string().optional(),
    address: required("Registered Address"),
    website: z.union([z.literal(""), z.string().url("Enter a full URL, e.g. https://example.com")]).optional(),
    countryCode: required("Country"),
    stateCode: required("State"),
    cityCode: required("City"),
    pinCode: required("PIN/Postal Code"),
    gstin: z.string().max(20).optional(),
    pan: z.string().max(20).optional(),
    alternateContactName: z.string().optional(),
    alternateContactEmail: z.union([z.literal(""), z.string().email("Enter a valid email")]).optional(),
    alternateContactPhone: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.organizationTypeCode === "other" && !val.organizationTypeOther) {
      ctx.addIssue({
        code: "custom",
        path: ["organizationTypeOther"],
        message: "Required when Client Type is Other",
      });
    }
  });

/** Screen 7 — Agreement Details */
export const agreementSchema = z
  .object({
    agreementTypeCode: required("Agreement Type"),
    agreementTypeOther: z.string().optional(),
    agreementNumber: required("Agreement Number / Reference"),
    agreementDate: dateString,
    agreementStartDate: dateString,
    agreementEndDate: dateString,
    agreementValue: money,
    paymentTermsCode: required("Payment Structure"),
    paymentTermsOther: z.string().optional(),
    paymentModeCode: z.string().optional(),
    paymentModeOther: z.string().optional(),
    numberOfInstallments: z.number().int().positive().optional(),
    renewalClause: z.string().optional(),
    confidentialityClause: yesNo.default(false),
    ipClause: yesNo.default(false),
    paymentTermsIncluded: yesNo.default(false),
  })
  .superRefine((val, ctx) => {
    if (val.agreementTypeCode === "other" && !val.agreementTypeOther) {
      ctx.addIssue({ code: "custom", path: ["agreementTypeOther"], message: "Required when Agreement Type is Other" });
    }
    if (val.paymentTermsCode === "other" && !val.paymentTermsOther) {
      ctx.addIssue({ code: "custom", path: ["paymentTermsOther"], message: "Required when Payment Structure is Other" });
    }
    if (val.paymentModeCode === "other" && !val.paymentModeOther) {
      ctx.addIssue({ code: "custom", path: ["paymentModeOther"], message: "Required when Payment Mode is Other" });
    }
    // Section 47.1
    if (val.agreementStartDate < val.agreementDate) {
      ctx.addIssue({ code: "custom", path: ["agreementStartDate"], message: "Start Date cannot be earlier than Agreement Date" });
    }
    if (val.agreementEndDate < val.agreementStartDate) {
      ctx.addIssue({ code: "custom", path: ["agreementEndDate"], message: "End Date cannot be earlier than Start Date" });
    }
  });

/** Screen 8 — Consultancy Team */
export const teamMemberSchema = z
  .object({
    userId: z.string().uuid().optional(),
    name: required("Name"),
    role: required("Role in Consultancy"),
    roleOther: z.string().optional(),
    department: required("Department"),
    isExternal: z.boolean().optional().default(false),
    employeeId: z.string().optional(),
    designation: z.string().optional(),
    estimatedHours: money.optional(),
    contributionPercent: money.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.role === "other" && !val.roleOther?.trim()) {
      ctx.addIssue({ code: "custom", path: ["roleOther"], message: "Specify the role" });
    }
    if (val.contributionPercent !== undefined) {
      const pct = Number(val.contributionPercent);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        ctx.addIssue({ code: "custom", path: ["contributionPercent"], message: "Enter a percentage between 0 and 100" });
      }
    }
  });

export const externalExpertSchema = z.object({
  name: required("Name"),
  organisation: required("Organisation"),
  expertise: z.string().optional(),
  role: required("Role"),
  engagementTerms: z.string().optional(),
});

export const teamSchema = z
  .object({
    members: z.array(teamMemberSchema).min(1, "At least one team member is required"),
    departmentsInvolved: z.array(z.string().uuid()).optional().default([]),
    externalExpertInvolved: yesNo.default(false),
    externalExpertDetails: z.string().optional(),
    externalExperts: z.array(externalExpertSchema).optional().default([]),
    rolesAndResponsibilities: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const principals = val.members.filter((m) => m.role === PRINCIPAL_CONSULTANT_ROLE).length;
    if (principals !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["members"],
        message: principals === 0 ? "A Principal Consultant is required" : "Only one team member can be the Principal Consultant",
      });
    }
    // Section 47.3 — if any contribution % is entered, they must total 100.
    const withPct = val.members.filter((m) => m.contributionPercent !== undefined);
    if (withPct.length > 0) {
      const total = withPct.reduce((sum, m) => sum + Number(m.contributionPercent), 0);
      if (withPct.length !== val.members.length || Math.abs(total - 100) > 0.01) {
        ctx.addIssue({
          code: "custom",
          path: ["members"],
          message: `Contribution percentages must be entered for every member and total 100% (currently ${total}%)`,
        });
      }
    }
    if (val.externalExpertInvolved && val.externalExperts.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["externalExperts"],
        message: "Add the external expert's details",
      });
    }
  });

/** Screen 10 — payment schedule rows entered at registration (status/reference/date are Finance's, later). */
export const paymentScheduleItemSchema = z.object({
  stageLabel: required("Payment Stage"),
  plannedAmount: money.refine((v) => Number(v) > 0, "Amount must be greater than zero"),
  plannedDate: dateString,
});

/** Screen 10 — Financial Details */
export const financialSchema = z
  .object({
    totalValue: money.refine((v) => Number(v) > 0, "Consultancy Value must be greater than zero"),
    currencyCode: z.string().min(1).default("INR"),
    currencyOther: z.string().optional(),
    taxApplicable: yesNo.default(false),
    taxRatePercent: z.string().optional().default("18"),
    taxAmount: z.string().optional(),
    grossTotalValue: z.string().optional(),
    institutionalSharePercent: z.string().optional(),
    institutionalShareAmount: z.string().optional(),
    facultySharePercent: z.string().optional(),
    facultyShareAmount: z.string().optional(),
    taxDetails: z.string().optional(),
    estimatedInstitutionalCosts: money.optional(),
    otherApprovedCosts: money.optional(),
    paymentSchedule: z.array(paymentScheduleItemSchema).min(1, "Add at least one payment stage"),
  })
  .superRefine((val, ctx) => {
    if (val.currencyCode === "other" && !val.currencyOther?.trim()) {
      ctx.addIssue({ code: "custom", path: ["currencyOther"], message: "Specify the currency" });
    }
    if (val.taxApplicable && (!val.taxRatePercent || Number(val.taxRatePercent) < 0)) {
      ctx.addIssue({ code: "custom", path: ["taxRatePercent"], message: "Valid Tax Rate (%) is required when Tax Applicable is Yes" });
    }
    // Section 47.2 — schedule total should equal the consultancy value.
    const total = val.paymentSchedule.reduce((sum, row) => sum + Number(row.plannedAmount), 0);
    if (Math.abs(total - Number(val.totalValue)) > 0.01) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentSchedule"],
        message: `Payment schedule totals ${total.toLocaleString("en-IN")} but the consultancy value is ${Number(val.totalValue).toLocaleString("en-IN")} — they must match`,
      });
    }
  });

/** Screen 6 — Key Deliverables */
export const deliverableSchema = z.object({
  name: required("Deliverable Name"),
  description: z.string().optional(),
  dueDate: dateString.optional(),
  responsibleConsultant: z.string().optional(),
});

/** Screen 6 — Consultancy Description + Key Deliverables */
export const scopeSchema = z.object({
  scopeOfWork: required("Scope of Work"),
  expectedOutcomes: required("Expected Outcomes"),
  clientAcceptanceRequired: yesNo.default(false),
  deliverables: z.array(deliverableSchema).min(1, "At least one deliverable is required"),
});

/** Screen 9 — milestones planned at registration */
export const plannedMilestoneSchema = z
  .object({
    title: required("Milestone"),
    description: required("Description"),
    startDate: dateString,
    plannedDate: dateString,
    responsiblePerson: required("Responsible Person"),
  })
  .superRefine((val, ctx) => {
    if (val.plannedDate < val.startDate) {
      ctx.addIssue({ code: "custom", path: ["plannedDate"], message: "Expected completion cannot precede the milestone start" });
    }
  });

export const timelineSchema = z.object({
  milestones: z.array(plannedMilestoneSchema).optional().default([]),
});

export const resourceItemSchema = z.object({
  resource: required("Resource"),
  purpose: required("Purpose"),
  estimatedUsage: z.string().optional(),
  facility: z.string().optional(),
  cost: z.string().optional(),
});

/** Screens 11 + 12 — Institutional Resources, IP & Confidentiality */
export const resourcesSchema = z
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
    resourceTypeCodes: z.array(z.string()).optional().default([]),
    resourceTypeOther: z.string().optional(),
    resourceItems: z.array(resourceItemSchema).optional().default([]),

    ipExpected: z.enum(["yes", "no", "not_applicable"], { error: "Select whether IP is expected" }),
    ipTypeCodes: z.array(z.string()).optional().default([]),
    ipTypeOther: z.string().optional(),
    ipOwnership: z.string().optional(),
    ipCommercialisationRights: z.string().optional(),
    ipRegistrationResponsibility: z.string().optional(),
    ipClauseReference: z.string().optional(),

    confidentialInformation: yesNo.default(false),
    ndaAvailable: z.boolean().optional(),
    confidentialityJustification: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.caiasResourcesRequired) {
      if (val.resourceTypeCodes.length === 0) {
        ctx.addIssue({ code: "custom", path: ["resourceTypeCodes"], message: "Select the resources that will be used" });
      }
      if (val.resourceTypeCodes.includes("other") && !val.resourceTypeOther?.trim()) {
        ctx.addIssue({ code: "custom", path: ["resourceTypeOther"], message: "Specify the other resource" });
      }
      if (val.resourceItems.length === 0) {
        ctx.addIssue({ code: "custom", path: ["resourceItems"], message: "Add resource details (resource and purpose)" });
      }
    }
    if (val.ipExpected === "yes") {
      if (val.ipTypeCodes.length === 0) ctx.addIssue({ code: "custom", path: ["ipTypeCodes"], message: "Select the type of IP" });
      if (val.ipTypeCodes.includes("other") && !val.ipTypeOther?.trim()) {
        ctx.addIssue({ code: "custom", path: ["ipTypeOther"], message: "Specify the other type of IP" });
      }
      if (!val.ipOwnership) ctx.addIssue({ code: "custom", path: ["ipOwnership"], message: "Ownership is required when IP is expected" });
      if (!val.ipCommercialisationRights) {
        ctx.addIssue({ code: "custom", path: ["ipCommercialisationRights"], message: "Commercialisation Rights are required when IP is expected" });
      }
      if (!val.ipRegistrationResponsibility) {
        ctx.addIssue({ code: "custom", path: ["ipRegistrationResponsibility"], message: "Registration Responsibility is required when IP is expected" });
      }
    }
    if (val.confidentialInformation) {
      if (val.ndaAvailable === undefined) {
        ctx.addIssue({ code: "custom", path: ["ndaAvailable"], message: "Say whether an NDA is available" });
      } else if (!val.ndaAvailable && !val.confidentialityJustification) {
        ctx.addIssue({
          code: "custom",
          path: ["confidentialityJustification"],
          message: "Explain how confidentiality is covered without an NDA",
        });
      }
    }
  });

export const declarationSchema = z.object(
  Object.fromEntries(
    DECLARATION_ITEMS.map((item) => [item.key, z.literal(true, { error: "This confirmation is required" })])
  ) as Record<DeclarationKey, z.ZodLiteral<true>>
);

export const submitConsultancyFieldsSchema = draftConsultancySchema.extend({
  startDate: dateString,
  expectedCompletionDate: dateString,
  agreementSignedStatus: z.enum(["mou", "consultancy_agreement", "work_order", "no"], {
    error: "Say whether the agreement has been signed",
  }),
  natureOfConsultancyCode: required("Nature of Consultancy"),
  natureOfConsultancyOther: z.string().optional(),
  consultancyTypeOther: z.string().optional(),
  consultancyDomainCodes: z.array(z.string()).min(1, "Select at least one Consultancy Domain"),
  consultancyDomainOther: z.string().optional(),
  consultancyCategoryCode: z.string().optional(),
  clientProblem: required("Problem / Requirement of Client"),
  objective: required("Objective of Consultancy"),
  reportingFrequency: required("Reporting Frequency"),
  reportingFrequencyOther: z.string().optional(),
});

/** Full submission payload — all sections required, cross-field rules enforced. */
export const submitConsultancySchema = z
  .object({
    consultancy: submitConsultancyFieldsSchema,
    client: clientSchema,
    agreement: agreementSchema,
    team: teamSchema,
    financial: financialSchema,
    scope: scopeSchema,
    timeline: timelineSchema.optional().default({ milestones: [] }),
    resources: resourcesSchema,
    declaration: declarationSchema,
  })
  .superRefine((val, ctx) => {
    for (const issue of consultancyCrossFieldIssues(val.consultancy)) {
      ctx.addIssue({ code: "custom", path: ["consultancy", issue.field], message: issue.message });
    }
  });

/** Cross-field rules on the consultancy section — shared with the wizard's per-step check. */
export function consultancyCrossFieldIssues(c: {
  consultancyAreaCode?: string;
  consultancyAreaOther?: string;
  consultancyTypeCode?: string;
  consultancyTypeOther?: string;
  consultancyDomainCodes?: string[];
  consultancyDomainOther?: string;
  natureOfConsultancyCode?: string;
  natureOfConsultancyOther?: string;
  reportingFrequency?: string;
  reportingFrequencyOther?: string;
  agreementSignedStatus?: string;
  startDate?: string;
  expectedCompletionDate?: string;
}): { field: string; message: string }[] {
  const issues: { field: string; message: string }[] = [];
  if (c.consultancyAreaCode === "other" && !c.consultancyAreaOther) {
    issues.push({ field: "consultancyAreaOther", message: "Required when Consultancy Area is Other" });
  }
  if (c.consultancyTypeCode === "other" && !c.consultancyTypeOther?.trim()) {
    issues.push({ field: "consultancyTypeOther", message: "Specify the consultancy type" });
  }
  if (c.consultancyDomainCodes?.includes("other") && !c.consultancyDomainOther?.trim()) {
    issues.push({ field: "consultancyDomainOther", message: "Specify the discipline / domain" });
  }
  if (c.natureOfConsultancyCode === "other" && !c.natureOfConsultancyOther) {
    issues.push({ field: "natureOfConsultancyOther", message: "Required when Nature of Consultancy is Other" });
  }
  if (c.reportingFrequency === "custom" && !c.reportingFrequencyOther) {
    issues.push({ field: "reportingFrequencyOther", message: "Describe the custom reporting frequency" });
  }
  if (c.agreementSignedStatus === "no") {
    issues.push({ field: "agreementSignedStatus", message: AGREEMENT_NOT_SIGNED_MESSAGE });
  }
  if (c.startDate && c.expectedCompletionDate && c.expectedCompletionDate < c.startDate) {
    issues.push({ field: "expectedCompletionDate", message: "Expected Completion Date cannot precede Start Date" });
  }
  return issues;
}

export type SubmitConsultancyInput = z.infer<typeof submitConsultancySchema>;
export type DraftConsultancyInput = z.infer<typeof draftConsultancySchema>;
