import type { ZodError } from "zod";

export type StepErrors = Record<string, string>;

const STEP_FOR_TOP_KEY: Record<string, number> = {
  client: 0,
  consultancy: 1,
  scope: 1,
  resources: 1,
  team: 2,
  agreement: 2,
  financial: 2,
};

/** Groups a `submitConsultancySchema` validation failure by wizard step, so the UI can jump to the earliest step with a problem and show inline messages there. */
export function mapZodErrorToSteps(error: ZodError): { errorsByStep: StepErrors[]; firstFailingStep: number } {
  const errorsByStep: StepErrors[] = [{}, {}, {}, {}];
  let firstFailingStep = 3;
  for (const issue of error.issues) {
    const topKey = String(issue.path[0] ?? "");
    const step = STEP_FOR_TOP_KEY[topKey] ?? 3;
    const path = issue.path.slice(1).join(".") || topKey;
    errorsByStep[step][path] = issue.message;
    if (step < firstFailingStep) firstFailingStep = step;
  }
  return { errorsByStep, firstFailingStep };
}
