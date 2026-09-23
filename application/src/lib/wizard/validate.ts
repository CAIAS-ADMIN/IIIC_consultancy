import type { ZodIssue } from "zod";
import {
  clientSchema,
  draftConsultancySchema,
  dateString,
  scopeSchema,
  teamSchema,
  agreementSchema,
  financialSchema,
  resourcesSchema,
} from "@/lib/validation/consultancy";
import { buildSubmitPayload } from "./payload";
import type { WizardState } from "./types";
import type { StepErrors } from "./errors";

const consultancySchema = draftConsultancySchema.extend({ startDate: dateString, expectedCompletionDate: dateString });

function issuesToErrors(issues: ZodIssue[]): StepErrors {
  const out: StepErrors = {};
  for (const issue of issues) {
    out[issue.path.join(".")] = issue.message;
  }
  return out;
}

/**
 * Client-side mirror of `submitConsultancySchema`'s per-section rules
 * (reusing the exact same zod schemas the backend validates with, not a
 * re-derived copy) — run when leaving a step, so a conditional-mandatory
 * field (Other -> specify, Yes -> detail, date ordering) is caught
 * immediately rather than only after a failed submit. The backend's
 * response is still the source of truth at actual submit time.
 */
export function validateStep(step: number, state: WizardState): { valid: boolean; errors: StepErrors } {
  const payload = buildSubmitPayload(state);
  const errors: StepErrors = {};

  if (step === 0) {
    const r = clientSchema.safeParse(payload.client);
    if (!r.success) Object.assign(errors, issuesToErrors(r.error.issues));
  } else if (step === 1) {
    const r1 = consultancySchema.safeParse(payload.consultancy);
    if (!r1.success) Object.assign(errors, issuesToErrors(r1.error.issues));
    const r2 = scopeSchema.safeParse(payload.scope);
    if (!r2.success) Object.assign(errors, issuesToErrors(r2.error.issues));
    if (payload.consultancy.consultancyAreaCode === "other" && !payload.consultancy.consultancyAreaOther) {
      errors.consultancyAreaOther = "Required when Consultancy Area is Other";
    }
    if (
      payload.consultancy.expectedCompletionDate &&
      payload.consultancy.startDate &&
      payload.consultancy.expectedCompletionDate < payload.consultancy.startDate
    ) {
      errors.expectedCompletionDate = "Expected Completion Date cannot precede Start Date";
    }
  } else if (step === 2) {
    const r1 = teamSchema.safeParse(payload.team);
    if (!r1.success) Object.assign(errors, issuesToErrors(r1.error.issues));
    const r2 = agreementSchema.safeParse(payload.agreement);
    if (!r2.success) Object.assign(errors, issuesToErrors(r2.error.issues));
    const r3 = financialSchema.safeParse(payload.financial);
    if (!r3.success) Object.assign(errors, issuesToErrors(r3.error.issues));
    const r4 = resourcesSchema.safeParse(payload.resources);
    if (!r4.success) Object.assign(errors, issuesToErrors(r4.error.issues));
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
