"use client";

import { DownloadRecordPdfButton } from "@/components/records/record-actions";
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
import { emptyStepErrors, mapZodErrorToSteps, type StepErrors } from "@/lib/wizard/errors";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ConsultancyStatus } from "@/db/schema/enums";
import { Step1Preliminary } from "./steps/step1-preliminary";
import { Step2Client } from "./steps/step2-client";
import { Step3ConsultancyScope } from "./steps/step3-consultancy-scope";
import { Step4TeamAgreement } from "./steps/step4-team-agreement";
import { Step5TimelineMilestones } from "./steps/step5-timeline-milestones";
import { Step6FinancialsTax } from "./steps/step6-financials-tax";
import { Step7ResourcesReview } from "./steps/step7-resources-review";
import type { MasterDataMap, PrincipalInfo, StaffMember } from "./wizard-props";

const STEPS = [
  { label: "Preliminary & Institutional" },
  { label: "Client Details" },
  { label: "Consultancy & Scope" },
  { label: "Agreement & Team" },
  { label: "Timeline & Milestones" },
  { label: "Financials & Tax" },
  { label: "Resources & Review" },
];

type SubmittedInfo = { consultancyCode: string | null; id: string; status: ConsultancyStatus; submittedAt: string | null };

/** Flattens a zod `flatten()` error body ({ formErrors, fieldErrors } or nested sections) into readable text. */
function describeServerErrors(error: unknown): string {
  const messages: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") messages.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(error);
  return [...new Set(messages)].slice(0, 6).join(" · ");
}

export function ConsultancyWizard({
  onBehalf = false,
  principal: signedInPrincipal,
  staff,
  departments,
  masterData,
  defaultAcademicYearCode,
  initialDraftId,
  initialState,
}: {
  onBehalf?: boolean;
  principal: PrincipalInfo;
  staff: StaffMember[];
  departments: { id: string; name: string }[];
  masterData: MasterDataMap;
  defaultAcademicYearCode: string;
  initialDraftId: string | null;
  initialState: WizardState | null;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [state, setState] = React.useState<WizardState>(
    () =>
      initialState ??
      createInitialWizardState(
        onBehalf
          ? { academicYearCode: defaultAcademicYearCode }
          : {
              academicYearCode: defaultAcademicYearCode,
              facultyInChargeId: signedInPrincipal.id,
              departmentId: signedInPrincipal.departmentId,
              principal: {
                name: signedInPrincipal.name,
                employeeId: signedInPrincipal.employeeId,
                departmentName: signedInPrincipal.departmentName,
              },
            }
      )
  );

  // Whoever the record is for: an admin sees the employee they picked, never their own details.
  const principal = React.useMemo<PrincipalInfo>(() => {
    const chosenId = state.consultancy.facultyInChargeId;
    if (!onBehalf && (!chosenId || chosenId === signedInPrincipal.id)) return signedInPrincipal;
    const chosen = staff.find((u) => u.id === chosenId);
    if (!chosen) return { id: "", name: "", employeeId: "", email: "", phone: "", departmentId: "", departmentName: "" };
    return {
      id: chosen.id,
      name: chosen.name,
      employeeId: chosen.employeeId ?? "",
      email: chosen.email ?? "",
      phone: chosen.phone ?? "",
      departmentId: chosen.departmentId ?? "",
      departmentName: departments.find((d) => d.id === chosen.departmentId)?.name ?? "",
    };
  }, [onBehalf, signedInPrincipal, staff, departments, state.consultancy.facultyInChargeId]);
  const [draftId, setDraftId] = React.useState<string | null>(initialDraftId);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [errorsByStep, setErrorsByStep] = React.useState<StepErrors[]>(emptyStepErrors);
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null);
  const [signedAgreementUploaded, setSignedAgreementUploaded] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState<SubmittedInfo | null>(null);

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

  /** Saves the draft (creating it if needed); resolves to its id, or null if it couldn't be saved. */
  async function saveDraft(options: { silent?: boolean } = {}): Promise<string | null> {
    const minimalCheck = validateStep(0, state);
    if (!draftId && (!state.consultancy.departmentId || !state.consultancy.academicYearCode)) {
      setErrorsByStep((prev) => {
        const next = [...prev];
        next[0] = { ...next[0], ...minimalCheck.errors };
        return next;
      });
      setStepIndex(0);
      if (!options.silent) {
        toast({
          title: "Select Department & Academic Year",
          description: "Department and academic year are needed to save a draft.",
          variant: "destructive",
        });
      }
      return null;
    }

    setSaving(true);
    try {
      const id = await ensureDraftExists();
      if (!id) {
        if (!options.silent) toast({ title: "Could not save draft", variant: "destructive" });
        return null;
      }
      const res = await fetch(`/api/consultancies/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildDraftPatchBody(state)),
      });
      if (!res.ok) {
        if (!options.silent) toast({ title: "Could not save draft", variant: "destructive" });
        return null;
      }
      setLastSavedAt(new Date());
      if (!options.silent) toast({ title: "Draft saved", variant: "success" });
      return id;
    } catch {
      if (!options.silent) {
        toast({ title: "Could not save draft", description: "Network error — check your connection and try again.", variant: "destructive" });
      }
      return null;
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
    if (!valid) {
      const messages = [...new Set(Object.values(errors))];
      toast({
        title: "Required Fields Missing",
        description:
          messages.slice(0, 5).join(" · ") + (messages.length > 5 ? ` · and ${messages.length - 5} more (highlighted below)` : ""),
        variant: "destructive",
      });
      return;
    }

    if (stepIndex === 0) {
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
      const messages = [...new Set(parsed.error.issues.map((i) => i.message))];
      setSubmitError(
        `Please complete ${messages.length === 1 ? "this" : "these"} before submitting: ${messages.slice(0, 6).join(" · ")}${
          messages.length > 6 ? ` · and ${messages.length - 6} more` : ""
        }. You've been taken to the first step that needs attention.`
      );
      return;
    }
    if (!signedAgreementUploaded) {
      setSubmitError(
        'The Signed MoU / Consultancy Agreement / Work Order has not been uploaded. In "Document Upload Checklist", choose that Document Type, pick the file and press Upload Document — files uploaded under another type (e.g. Scope of Work) don\'t count.'
      );
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
        setSubmitError(typeof body.error === "string" ? body.error : `Submission failed: ${describeServerErrors(body.error) || "please try again."}`);
        return;
      }
      setSubmitted({
        consultancyCode: body.data.consultancyCode ?? null,
        id: body.data.id,
        status: body.data.status,
        submittedAt: body.data.submittedAt ?? null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    const registeredOn = submitted.submittedAt ? new Date(submitted.submittedAt) : new Date();
    return (
      <Card className="mx-auto w-full max-w-lg">
        <CardContent className="flex flex-col items-center gap-5 p-6 text-center sm:p-8">
          <h1 className="text-xl font-bold text-foreground">Consultancy Registration Submitted Successfully</h1>
          <dl className="grid w-full gap-3 text-left sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Consultancy ID</dt>
              <dd className="mt-1 rounded-md bg-primary-soft px-3 py-2 font-mono text-sm font-semibold text-primary-soft-foreground">
                {submitted.consultancyCode ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Registration Date</dt>
              <dd className="text-sm text-foreground">
                {registeredOn.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd>
                <StatusBadge status={submitted.status} />
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Next Step</dt>
              <dd className="text-sm text-foreground">
                {submitted.status === "registered"
                  ? "No verification stage is configured for this consultancy, so it is registered and can be activated."
                  : "The consultancy registration is now available in the CAIAS Consultancy Portal for verification."}
              </dd>
            </div>
          </dl>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <DownloadRecordPdfButton consultancyId={submitted.id} kind="registration" label="Download Registration PDF" variant="secondary" />
            <Button onClick={() => router.push(`/consultancies/${submitted.id}`)}>View Consultancy</Button>
          </div>
          <Link href="/dashboard" className="text-sm text-primary underline-offset-4 hover:underline">
            Return to Dashboard
          </Link>
        </CardContent>
      </Card>
    );
  }

  const stepProps = {
    state,
    errors: errorsByStep[stepIndex],
    masterData,
    departments,
    staff,
    principal,
    onBehalf,
    updateConsultancy: (patch: Partial<WizardState["consultancy"]>) => updateSection("consultancy", patch),
    updateClient: (patch: Partial<WizardState["client"]>) => updateSection("client", patch),
    updateAgreement: (patch: Partial<WizardState["agreement"]>) => updateSection("agreement", patch),
    updateTeam: (patch: Partial<WizardState["team"]>) => updateSection("team", patch),
    updateFinancial: (patch: Partial<WizardState["financial"]>) => updateSection("financial", patch),
    updateScope: (patch: Partial<WizardState["scope"]>) => updateSection("scope", patch),
    updateTimeline: (patch: Partial<WizardState["timeline"]>) => updateSection("timeline", patch),
    updateResources: (patch: Partial<WizardState["resources"]>) => updateSection("resources", patch),
    updateDeclaration: (patch: Partial<WizardState["declaration"]>) => updateSection("declaration", patch),
  };

  return (
    <div className="flex flex-col gap-6 pb-24 md:pb-6">
      <Stepper steps={STEPS} currentIndex={stepIndex} />

      <Card>
        <CardContent className="p-5 md:p-6">
          {stepIndex === 0 && <Step1Preliminary {...stepProps} />}
          {stepIndex === 1 && <Step2Client {...stepProps} />}
          {stepIndex === 2 && <Step3ConsultancyScope {...stepProps} />}
          {stepIndex === 3 && <Step4TeamAgreement {...stepProps} />}
          {stepIndex === 4 && <Step5TimelineMilestones {...stepProps} />}
          {stepIndex === 5 && <Step6FinancialsTax {...stepProps} />}
          {stepIndex === 6 && (
            <Step7ResourcesReview
              {...stepProps}
              draftId={draftId}
              ensureDraftSaved={() => saveDraft({ silent: true })}
              signedAgreementUploaded={signedAgreementUploaded}
              onSignedAgreementChange={setSignedAgreementUploaded}
              onEditStep={goToStep}
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
