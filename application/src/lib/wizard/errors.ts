import type { ZodError } from "zod";

export type StepErrors = Record<string, string>;

/** Which submit-payload sections each wizard step collects (index = step). */
export const STEP_SECTIONS: string[][] = [
  ["preliminary"],
  ["client"],
  ["consultancy", "scope"],
  ["team", "agreement"],
  ["timeline"],
  ["financial"],
  ["resources", "declaration"],
];

export const STEP_COUNT = STEP_SECTIONS.length;

const STEP_FOR_SECTION: Record<string, number> = Object.fromEntries(
  STEP_SECTIONS.flatMap((sections, step) => sections.map((section) => [section, step]))
);

const FIELD_STEP_OVERRIDES: Record<string, number> = {
  "consultancy.facultyInChargeId": 0,
  "consultancy.departmentId": 0,
  "consultancy.academicYearCode": 0,
  "consultancy.agreementSignedStatus": 0,
  "consultancy.departmentCoordinatorId": 0,
  "consultancy.startDate": 4,
  "consultancy.expectedCompletionDate": 4,
  "consultancy.reportingFrequency": 4,
  "consultancy.reportingFrequencyOther": 4,
  "agreement.agreementStartDate": 4,
  "agreement.agreementEndDate": 4,
  "agreement.agreementValue": 5,
  "agreement.paymentTermsCode": 5,
  "agreement.paymentTermsOther": 5,
  "agreement.paymentModeCode": 5,
  "agreement.paymentModeOther": 5,
};

export function emptyStepErrors(): StepErrors[] {
  return STEP_SECTIONS.map(() => ({}));
}

/** Groups a `submitConsultancySchema` validation failure by wizard step, so the UI can jump to the earliest step with a problem and show inline messages there. */
export function mapZodErrorToSteps(error: ZodError): { errorsByStep: StepErrors[]; firstFailingStep: number } {
  const errorsByStep = emptyStepErrors();
  let firstFailingStep = STEP_COUNT - 1;
  for (const issue of error.issues) {
    const topKey = String(issue.path[0] ?? "");
    const subKey = String(issue.path[1] ?? "");
    let step = STEP_FOR_SECTION[topKey] ?? STEP_COUNT - 1;
    
    // Fields whose payload section differs from the screen that collects them.
    const override = FIELD_STEP_OVERRIDES[`${topKey}.${subKey}`];
    if (override !== undefined) {
      step = override;
    }

    const path = issue.path.slice(1).join(".") || topKey;
    errorsByStep[step][path] ??= issue.message;
    if (step < firstFailingStep) firstFailingStep = step;
  }
  return { errorsByStep, firstFailingStep };
}
