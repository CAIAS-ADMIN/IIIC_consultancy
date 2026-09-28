import { z, type ZodType } from "zod";
import {
  agreementSchema,
  clientSchema,
  dateString,
  declarationSchema,
  financialSchema,
  plannedMilestoneSchema,
  resourcesSchema,
  teamSchema,
} from "@/lib/validation/consultancy";
import type { WizardState } from "./types";
import { type StepErrors } from "./errors";

const reqStr = (label: string) => z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`);

export const step0PreliminarySchema = z.object({
  facultyInChargeId: z.string({ error: "Select the faculty consultant" }).uuid("Select the faculty consultant"),
  departmentId: z.string({ error: "Department is required" }).uuid("Select a department"),
  academicYearCode: z.string({ error: "Academic Year is required" }).min(1, "Select an academic year"),
  agreementSignedStatus: z.enum(["mou", "consultancy_agreement", "work_order", "no"], {
    error: "Select whether the agreement has been signed",
  }),
});

export const step2ConsultancyScopeSchema = z
  .object({
    title: reqStr("Consultancy Title"),
    natureOfConsultancyCode: reqStr("Nature of Consultancy"),
    natureOfConsultancyOther: z.string().optional(),
    consultancyCategoryCode: reqStr("Consultancy Category"),
    consultancyTypeCode: reqStr("Consultancy Type"),
    consultancyTypeOther: z.string().optional(),
    consultancyAreaCode: reqStr("Consultancy Area"),
    consultancyAreaOther: z.string().optional(),
    consultancyDomainCodes: z.array(z.string()).min(1, "Select at least one Consultancy Domain"),
    consultancyDomainOther: z.string().optional(),
    clientProblem: reqStr("Problem / Requirement of Client"),
    objective: reqStr("Objective of Consultancy"),
    scopeOfWork: reqStr("Scope of Work"),
    expectedOutcomes: reqStr("Expected Outcomes"),
  })
  .superRefine((val, ctx) => {
    if (val.natureOfConsultancyCode === "other" && !val.natureOfConsultancyOther) {
      ctx.addIssue({ code: "custom", path: ["natureOfConsultancyOther"], message: "Required when Nature of Consultancy is Other" });
    }
    if (val.consultancyAreaCode === "other" && !val.consultancyAreaOther?.trim()) {
      ctx.addIssue({ code: "custom", path: ["consultancyAreaOther"], message: "Specify the consultancy area" });
    }
    if (val.consultancyTypeCode === "other" && !val.consultancyTypeOther?.trim()) {
      ctx.addIssue({ code: "custom", path: ["consultancyTypeOther"], message: "Specify the consultancy type" });
    }
    if (val.consultancyDomainCodes.includes("other") && !val.consultancyDomainOther?.trim()) {
      ctx.addIssue({ code: "custom", path: ["consultancyDomainOther"], message: "Specify the discipline / domain" });
    }
  });

export const step4TimelineSchema = z
  .object({
    startDate: dateString,
    expectedCompletionDate: dateString,
    reportingFrequency: reqStr("Reporting Frequency"),
    reportingFrequencyOther: z.string().optional(),
    milestones: z.array(plannedMilestoneSchema).min(1, "Add at least one milestone / deliverable"),
  })
  .superRefine((val, ctx) => {
    if (val.reportingFrequency === "custom" && !val.reportingFrequencyOther) {
      ctx.addIssue({ code: "custom", path: ["reportingFrequencyOther"], message: "Describe the custom reporting frequency" });
    }
    if (val.startDate && val.expectedCompletionDate && val.expectedCompletionDate < val.startDate) {
      ctx.addIssue({ code: "custom", path: ["expectedCompletionDate"], message: "Expected Completion Date cannot precede Start Date" });
    }
  });

/**
 * Validates only the fields rendered on the specified step index (0 through 6).
 */
/**
 * `agreementSchema` spans three screens: its dates/value are derived from
 * Timeline & Financials fields (validated there), and payment terms/mode are
 * entered on Financials. Each step only reports the agreement fields it
 * actually shows, so an error never lands on a screen with nowhere to show it.
 */
const AGREEMENT_FIELDS_ON_TEAM_STEP = new Set(["agreementTypeCode", "agreementTypeOther", "agreementNumber", "agreementDate"]);
const AGREEMENT_FIELDS_ON_FINANCIALS_STEP = new Set(["paymentTermsCode", "paymentTermsOther", "paymentModeCode", "paymentModeOther"]);

function agreementErrorsFor(state: WizardState, fields: Set<string>): StepErrors {
  const errors: StepErrors = {};
  const res = agreementSchema.safeParse(state.agreement);
  if (!res.success) {
    for (const issue of res.error.issues) {
      const key = issue.path.join(".");
      if (fields.has(key)) errors[key] ??= issue.message;
    }
  }
  return errors;
}

export function validateStep(step: number, state: WizardState): { valid: boolean; errors: StepErrors } {
  const errors: StepErrors = {};

  if (step === 0) {
    // Step 1: Preliminary & Institutional
    const res = step0PreliminarySchema.safeParse(state.consultancy);
    if (!res.success) {
      for (const issue of res.error.issues) {
        const key = issue.path.join(".");
        errors[key] = issue.message;
      }
    }
  } else if (step === 1) {
    // Step 2: Client Details
    const res = clientSchema.safeParse(state.client);
    if (!res.success) {
      for (const issue of res.error.issues) {
        const key = issue.path.join(".");
        errors[key] = issue.message;
      }
    }
  } else if (step === 2) {
    // Step 3: Consultancy & Scope
    const data = {
      ...state.consultancy,
      scopeOfWork: state.scope.scopeOfWork,
      expectedOutcomes: state.scope.expectedOutcomes,
    };
    const res = step2ConsultancyScopeSchema.safeParse(data);
    if (!res.success) {
      for (const issue of res.error.issues) {
        const key = issue.path.join(".");
        errors[key] = issue.message;
      }
    }
  } else if (step === 3) {
    // Step 4: Agreement & Team — keys unprefixed, as the step reads them (and as `mapZodErrorToSteps` produces)
    Object.assign(errors, agreementErrorsFor(state, AGREEMENT_FIELDS_ON_TEAM_STEP));
    // A section switched back to "No" keeps its half-filled rows in state (so switching back to "Yes" restores
    // them) but must not be validated — the same way the submit payload drops them.
    const resTeam = teamSchema.safeParse({
      ...state.team,
      externalExperts: state.team.externalExpertInvolved ? state.team.externalExperts : [],
    });
    if (!resTeam.success) {
      for (const issue of resTeam.error.issues) {
        const key = issue.path.join(".");
        errors[key] = issue.message;
      }
    }
  } else if (step === 4) {
    // Step 5: Timeline & Milestones
    const data = {
      startDate: state.consultancy.startDate,
      expectedCompletionDate: state.consultancy.expectedCompletionDate,
      reportingFrequency: state.consultancy.reportingFrequency,
      reportingFrequencyOther: state.consultancy.reportingFrequencyOther,
      milestones: state.timeline.milestones,
    };
    const res = step4TimelineSchema.safeParse(data);
    if (!res.success) {
      for (const issue of res.error.issues) {
        const key = issue.path.join(".");
        errors[key] = issue.message;
      }
    }
  } else if (step === 5) {
    // Step 6: Financials & Tax (payment terms/mode live on the agreement)
    const res = financialSchema.safeParse(state.financial);
    if (!res.success) {
      for (const issue of res.error.issues) {
        const key = issue.path.join(".");
        errors[key] = issue.message;
      }
    }
    Object.assign(errors, agreementErrorsFor(state, AGREEMENT_FIELDS_ON_FINANCIALS_STEP));
  } else if (step === 6) {
    // Step 7: Resources & Review
    const r = state.resources;
    const resRes = resourcesSchema.safeParse({
      ...r,
      resourceTypeCodes: r.caiasResourcesRequired ? r.resourceTypeCodes : [],
      resourceItems: r.caiasResourcesRequired ? r.resourceItems : [],
      ipTypeCodes: r.ipExpected === "yes" ? r.ipTypeCodes : [],
    });
    if (!resRes.success) {
      for (const issue of resRes.error.issues) {
        const key = issue.path.join(".");
        errors[key] = issue.message;
      }
    }
    const resDec = declarationSchema.safeParse(state.declaration);
    if (!resDec.success) {
      for (const issue of resDec.error.issues) {
        const key = issue.path.join(".");
        errors[key] = issue.message;
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

