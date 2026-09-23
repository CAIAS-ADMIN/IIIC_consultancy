"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Stepper } from "@/components/ui/stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { submitConsultancySchema } from "@/lib/validation/consultancy";
import { createInitialWizardState, type WizardState } from "@/lib/wizard/types";
import { buildDraftMinimal, buildDraftPatchBody, buildSubmitPayload } from "@/lib/wizard/payload";
import { validateStep } from "@/lib/wizard/validate";
import { mapZodErrorToSteps, type StepErrors } from "@/lib/wizard/errors";
import { Step1Client } from "./steps/step1-client";
import { Step2Consultancy } from "./steps/step2-consultancy";
import { Step3TeamAgreement } from "./steps/step3-team-agreement";
import { Step4Review } from "./steps/step4-review";
import type { MasterDataMap } from "./wizard-props";

const STEPS = [
  { label: "Client Details" },
  { label: "Consultancy Details" },
  { label: "Team & Agreement" },
  { label: "Review & Submit" },
];

const EMPTY_ERRORS: StepErrors[] = [{}, {}, {}, {}];

export function ConsultancyWizard({
  facultyName,
  departments,
  masterData,
  defaultAcademicYearCode,
  initialDraftId,
  initialState,
}: {
  facultyName: string;
  departments: { id: string; name: string }[];
  masterData: MasterDataMap;
  defaultAcademicYearCode: string;
  initialDraftId: string | null;
  initialState: WizardState | null;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [state, setState] = React.useState<WizardState>(
    () => initialState ?? createInitialWizardState({ academicYearCode: defaultAcademicYearCode, facultyName })
  );
  const [draftId, setDraftId] = React.useState<string | null>(initialDraftId);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [errorsByStep, setErrorsByStep] = React.useState<StepErrors[]>(EMPTY_ERRORS);
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null);
  const [signedAgreementUploaded, setSignedAgreementUploaded] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState<{ consultancyCode: string | null; id: string } | null>(null);

  function updateSection<K extends keyof WizardState>(key: K, patch: Partial<WizardState[K]>) {
    setState((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function ensureDraftExists(): Promise<string | null> {
    if (draftId) return draftId;
    const minimal = buildDraftMinimal(state);
    const res = await fetch("/api/consultancies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(minimal),
    });
    if (!res.ok) return null;
    const { data } = await res.json();
    setDraftId(data.id);
    return data.id as string;
  }

  async function saveDraft(options: { silent?: boolean } = {}): Promise<boolean> {
    const minimalCheck = validateStep(1, state);
    // Consultancy Details carries the fields a draft row actually needs to exist
    // (title/department/type/area/academic year) — without them there's nothing
    // to create yet, so send the user there instead of a failed request.
    if (!draftId && (!state.consultancy.title.trim() || !state.consultancy.departmentId || !state.consultancy.consultancyTypeCode || !state.consultancy.teamTypeCode || !state.consultancy.consultancyAreaCode || !state.consultancy.academicYearCode)) {
      setErrorsByStep((prev) => {
        const next = [...prev];
        next[1] = { ...next[1], ...minimalCheck.errors };
        return next;
      });
      setStepIndex(1);
      if (!options.silent) {
        toast({
          title: "Complete Consultancy Details first",
          description: "Title, department, academic year, type, and area are needed to save a draft.",
          variant: "destructive",
        });
      }
      return false;
    }

    setSaving(true);
    try {
      const id = await ensureDraftExists();
      if (!id) {
        if (!options.silent) toast({ title: "Could not save draft", variant: "destructive" });
        return false;
      }
      const res = await fetch(`/api/consultancies/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildDraftPatchBody(state)),
      });
      if (!res.ok) {
        if (!options.silent) toast({ title: "Could not save draft", variant: "destructive" });
        return false;
      }
      setLastSavedAt(new Date());
      if (!options.silent) toast({ title: "Draft saved", variant: "success" });
      return true;
    } catch {
      if (!options.silent) {
        toast({ title: "Could not save draft", description: "Network error — check your connection and try again.", variant: "destructive" });
      }
      return false;
    } finally {
      setSaving(false);
    }
  }

  function goToStep(next: number) {
    setStepIndex(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleNext() {
    const { valid, errors } = validateStep(stepIndex, state);
    setErrorsByStep((prev) => {
      const copy = [...prev];
      copy[stepIndex] = errors;
      return copy;
    });
    if (!valid) return;

    // Ensure the draft row exists once Consultancy Details is complete, so
    // Step 4's document upload has a consultancy id to attach to well before
    // the user reaches it.
    if (stepIndex === 1) {
      await saveDraft({ silent: true });
    }
    goToStep(Math.min(stepIndex + 1, STEPS.length - 1));
  }

  function handleBack() {
    goToStep(Math.max(stepIndex - 1, 0));
  }

  async function handleSubmit() {
    setSubmitError(null);
    const payload = buildSubmitPayload(state);
    const parsed = submitConsultancySchema.safeParse(payload);
    if (!parsed.success) {
      const { errorsByStep: mapped, firstFailingStep } = mapZodErrorToSteps(parsed.error);
      setErrorsByStep(mapped);
      goToStep(firstFailingStep);
      setSubmitError("Some required fields are missing or invalid — fixed steps are highlighted above.");
      return;
    }
    if (!signedAgreementUploaded) {
      setSubmitError("Upload the Signed Agreement document before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const id = await ensureDraftExists();
      if (!id) {
        setSubmitError("Could not create the consultancy record. Please try again.");
        return;
      }
      const res = await fetch(`/api/consultancies/${id}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(typeof body.error === "string" ? body.error : "Submission failed. Please try again.");
        return;
      }
      setSubmitted({ consultancyCode: body.data.consultancyCode ?? null, id: body.data.id });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <h1 className="text-xl font-bold text-foreground">Consultancy Submitted</h1>
          <p className="text-sm text-muted-foreground">
            Your consultancy has been submitted for verification.
          </p>
          {submitted.consultancyCode && (
            <p className="rounded-md bg-primary-soft px-4 py-2 font-mono text-sm font-semibold text-primary-soft-foreground">
              {submitted.consultancyCode}
            </p>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" asChild>
              <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
            <Button onClick={() => router.push(`/consultancies/${submitted.id}`)}>View Consultancy</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const stepProps = {
    state,
    errors: errorsByStep[stepIndex],
    masterData,
    departments,
    updateConsultancy: (patch: Partial<WizardState["consultancy"]>) => updateSection("consultancy", patch),
    updateClient: (patch: Partial<WizardState["client"]>) => updateSection("client", patch),
    updateAgreement: (patch: Partial<WizardState["agreement"]>) => updateSection("agreement", patch),
    updateTeam: (patch: Partial<WizardState["team"]>) => updateSection("team", patch),
    updateFinancial: (patch: Partial<WizardState["financial"]>) => updateSection("financial", patch),
    updateScope: (patch: Partial<WizardState["scope"]>) => updateSection("scope", patch),
    updateResources: (patch: Partial<WizardState["resources"]>) => updateSection("resources", patch),
  };

  return (
    <div className="flex flex-col gap-6 pb-24 md:pb-6">
      <Stepper steps={STEPS} currentIndex={stepIndex} />

      <Card>
        <CardContent className="p-5 md:p-6">
          {stepIndex === 0 && <Step1Client {...stepProps} />}
          {stepIndex === 1 && <Step2Consultancy {...stepProps} />}
          {stepIndex === 2 && <Step3TeamAgreement {...stepProps} />}
          {stepIndex === 3 && (
            <Step4Review
              {...stepProps}
              draftId={draftId}
              signedAgreementUploaded={signedAgreementUploaded}
              onSignedAgreementChange={setSignedAgreementUploaded}
              submitError={submitError}
            />
          )}
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-16 z-30 flex items-center justify-between gap-2 border-t border-border bg-card px-4 py-3 md:static md:z-auto md:rounded-lg md:border md:px-5">
        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <Button type="button" variant="secondary" onClick={handleBack} disabled={saving || submitting}>
              Back
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => saveDraft()} disabled={saving || submitting}>
            {saving ? "Saving…" : "Save Draft"}
          </Button>
          {lastSavedAt && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Saved {lastSavedAt.toLocaleTimeString()}
            </span>
          )}
        </div>

        {stepIndex < STEPS.length - 1 ? (
          <Button type="button" onClick={handleNext} disabled={saving || submitting}>
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        )}
      </div>
    </div>
  );
}
