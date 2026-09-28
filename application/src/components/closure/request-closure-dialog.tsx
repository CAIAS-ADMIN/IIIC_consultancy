"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field, MasterDataSelect, SectionHeading } from "@/components/wizard/field";
import { DocumentCategoryPanel } from "@/components/documents/document-category-panel";
import { useToast } from "@/components/ui/use-toast";
import { apiErrorMessage } from "@/lib/api-error";
import { formatInr } from "@/lib/format";
import { durationInDays } from "@/lib/wizard/types";
import { CLOSURE_DECLARATION_ITEMS, FINAL_OUTCOME_OPTIONS, requestClosureSchema } from "@/lib/validation/closure";

const FINAL_REPORT_CATEGORY = "Final Report";

const COMPLETION_OPTIONS = [
  { code: "yes", label: "Yes" },
  { code: "partially", label: "Partially" },
  { code: "no", label: "No" },
] as const;

type Completion = "yes" | "partially" | "no";

type DeliverableOption = { id: string; name: string; dueDate: string | null };

/**
 * The Online Closure / Exit Form (portal spec Screens 21–25): completion
 * details, per-deliverable status, final outcome, the consultant's final
 * financial statement, the final report upload (Phase 4 document manager)
 * and the closure declaration.
 */
export function RequestClosureDialog({
  consultancyId,
  startDate,
  deliverables,
  financial,
}: {
  consultancyId: string;
  startDate: string | null;
  deliverables: DeliverableOption[];
  financial: { totalValue: number; totalReceived: number; amountPending: number };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [finalReportUploaded, setFinalReportUploaded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [form, setForm] = React.useState({
    actualCompletionDate: "",
    finalProgressPercent: "100",
    deliverableCompletionStatus: "yes" as Completion,
    partialReason: "",
    finalOutcome: "completed_successfully",
    outcomeReason: "",
    finalOutcomes: "",
    fullPaymentReceived: financial.amountPending <= 0,
    amountPending: financial.amountPending > 0 ? String(financial.amountPending) : "",
    pendingReason: "",
    expectedPaymentDate: "",
  });
  const [outcomes, setOutcomes] = React.useState(() =>
    deliverables.map((d) => ({ deliverableId: d.id, completed: "yes" as Completion, completionDate: "", remarks: "" }))
  );
  const [declaration, setDeclaration] = React.useState<Record<string, boolean>>({});

  const duration = durationInDays(startDate ?? "", form.actualCompletionDate);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function handleSubmit() {
    setSaving(true);
    try {
      const docsRes = await fetch(`/api/consultancies/${consultancyId}/documents?category=${encodeURIComponent(FINAL_REPORT_CATEGORY)}`);
      const docsBody = await docsRes.json().catch(() => ({}));
      const finalReport = ((docsBody.data ?? []) as { id: string; status: string }[]).find((d) => d.status === "available");
      if (!finalReport) {
        toast({ title: "Upload the final report before requesting closure", variant: "destructive" });
        return;
      }

      const payload = {
        actualCompletionDate: form.actualCompletionDate,
        finalProgressPercent: Number(form.finalProgressPercent),
        deliverableCompletionStatus: form.deliverableCompletionStatus,
        partialReason: form.deliverableCompletionStatus !== "yes" ? form.partialReason || undefined : undefined,
        deliverableOutcomes: outcomes.map((o) => ({
          deliverableId: o.deliverableId,
          completed: o.completed,
          completionDate: o.completionDate || undefined,
          remarks: o.remarks || undefined,
        })),
        finalOutcome: form.finalOutcome,
        outcomeReason: form.outcomeReason || undefined,
        finalOutcomes: form.finalOutcomes,
        fullPaymentReceived: form.fullPaymentReceived,
        amountPending: form.fullPaymentReceived ? undefined : form.amountPending || undefined,
        pendingReason: form.fullPaymentReceived ? undefined : form.pendingReason || undefined,
        expectedPaymentDate: form.fullPaymentReceived ? undefined : form.expectedPaymentDate || undefined,
        finalReportDocumentId: finalReport.id,
        declaration,
      };
      const parsed = requestClosureSchema.safeParse(payload);
      if (!parsed.success) {
        const next: Record<string, string> = {};
        for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
        setErrors(next);
        toast({ title: "Some closure details are missing", description: "Check the highlighted fields.", variant: "destructive" });
        return;
      }
      setErrors({});

      const res = await fetch(`/api/consultancies/${consultancyId}/closures`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Could not request closure", description: apiErrorMessage(body), variant: "destructive" });
        return;
      }
      toast({ title: "Closure requested", variant: "success" });
      setOpen(false);
      router.refresh();
    } catch {
      toast({ title: "Could not request closure", description: "Network error — check your connection and try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Request Closure
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Consultancy Closure / Exit Form</DialogTitle>
            <DialogDescription>CAIAS will check this against the closure checklist; Finance confirms the financial position.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
              <SectionHeading>Completion Details</SectionHeading>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Actual Completion Date" htmlFor="rc-date" required error={errors.actualCompletionDate}>
                  <Input id="rc-date" type="date" value={form.actualCompletionDate} onChange={(e) => set({ actualCompletionDate: e.target.value })} />
                </Field>
                <Field label="Total Duration">
                  <p className="py-2 text-sm text-foreground">{duration === null ? "—" : `${duration} days`}</p>
                </Field>
                <Field label="Final Progress (%)" htmlFor="rc-progress" required error={errors.finalProgressPercent}>
                  <Input
                    id="rc-progress"
                    type="number"
                    min="0"
                    max="100"
                    value={form.finalProgressPercent}
                    onChange={(e) => set({ finalProgressPercent: e.target.value })}
                  />
                </Field>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeading>Work Completion</SectionHeading>
              <Field label="Were all agreed deliverables completed?" required>
                <SegmentedChoice
                  label="Were all agreed deliverables completed?"
                  options={COMPLETION_OPTIONS}
                  value={form.deliverableCompletionStatus}
                  onChange={(v) => set({ deliverableCompletionStatus: v as Completion })}
                />
              </Field>
              {form.deliverableCompletionStatus !== "yes" && (
                <Field label="Reason / Explanation" htmlFor="rc-partial-reason" required error={errors.partialReason}>
                  <Textarea id="rc-partial-reason" value={form.partialReason} onChange={(e) => set({ partialReason: e.target.value })} />
                </Field>
              )}
              {deliverables.map((d, i) => (
                <div key={d.id} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-3">
                  <p className="text-sm font-medium text-foreground sm:col-span-3">
                    {d.name}
                    {d.dueDate && <span className="font-normal text-muted-foreground"> — planned {d.dueDate}</span>}
                  </p>
                  <Field label="Completed" htmlFor={`rc-d-${i}`}>
                    <MasterDataSelect
                      id={`rc-d-${i}`}
                      options={[...COMPLETION_OPTIONS]}
                      value={outcomes[i].completed}
                      onChange={(v) => setOutcomes((prev) => prev.map((o, j) => (j === i ? { ...o, completed: v as Completion } : o)))}
                    />
                  </Field>
                  <Field label="Completion Date" htmlFor={`rc-dd-${i}`} error={errors[`deliverableOutcomes.${i}.completionDate`]}>
                    <Input
                      id={`rc-dd-${i}`}
                      type="date"
                      value={outcomes[i].completionDate}
                      onChange={(e) => setOutcomes((prev) => prev.map((o, j) => (j === i ? { ...o, completionDate: e.target.value } : o)))}
                    />
                  </Field>
                  <Field label="Remarks" htmlFor={`rc-dr-${i}`}>
                    <Input
                      id={`rc-dr-${i}`}
                      value={outcomes[i].remarks}
                      onChange={(e) => setOutcomes((prev) => prev.map((o, j) => (j === i ? { ...o, remarks: e.target.value } : o)))}
                    />
                  </Field>
                </div>
              ))}
              {deliverables.length > 0 && (
                <p className="text-xs text-muted-foreground">Upload deliverable evidence in Documents → Execution → Deliverable.</p>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeading>Final Outcome</SectionHeading>
              <Field label="Final Outcome" htmlFor="rc-outcome" required error={errors.finalOutcome}>
                <MasterDataSelect id="rc-outcome" options={[...FINAL_OUTCOME_OPTIONS]} value={form.finalOutcome} onChange={(v) => set({ finalOutcome: v })} />
              </Field>
              {(form.finalOutcome === "terminated" || form.finalOutcome === "cancelled") && (
                <Field label="Reason" htmlFor="rc-outcome-reason" required error={errors.outcomeReason}>
                  <Textarea id="rc-outcome-reason" value={form.outcomeReason} onChange={(e) => set({ outcomeReason: e.target.value })} />
                </Field>
              )}
              <Field label="Final Outcomes Summary" htmlFor="rc-outcomes" required error={errors.finalOutcomes}>
                <Textarea id="rc-outcomes" value={form.finalOutcomes} onChange={(e) => set({ finalOutcomes: e.target.value })} />
              </Field>
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeading>Final Financial Closure</SectionHeading>
              <p className="text-sm text-muted-foreground">
                Value {formatInr(financial.totalValue)} · Received {formatInr(financial.totalReceived)} · Balance {formatInr(financial.amountPending)} (as
                recorded by Finance)
              </p>
              <Field label="Is the full consultancy amount received?" required>
                <SegmentedChoice
                  label="Is the full consultancy amount received?"
                  options={[
                    { code: "yes", label: "Yes" },
                    { code: "no", label: "No" },
                  ]}
                  value={form.fullPaymentReceived ? "yes" : "no"}
                  onChange={(v) => set({ fullPaymentReceived: v === "yes" })}
                />
              </Field>
              {!form.fullPaymentReceived && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Amount Pending (₹)" htmlFor="rc-pending" required error={errors.amountPending}>
                    <Input id="rc-pending" type="number" min="0" value={form.amountPending} onChange={(e) => set({ amountPending: e.target.value })} />
                  </Field>
                  <Field label="Expected Payment Date" htmlFor="rc-expected" required error={errors.expectedPaymentDate}>
                    <Input id="rc-expected" type="date" value={form.expectedPaymentDate} onChange={(e) => set({ expectedPaymentDate: e.target.value })} />
                  </Field>
                  <Field label="Reason" htmlFor="rc-pending-reason" required error={errors.pendingReason} className="sm:col-span-2">
                    <Input id="rc-pending-reason" value={form.pendingReason} onChange={(e) => set({ pendingReason: e.target.value })} />
                  </Field>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeading>Final Consultancy Report</SectionHeading>
              <DocumentCategoryPanel
                consultancyId={consultancyId}
                category={FINAL_REPORT_CATEGORY}
                label="Final Consultancy Report"
                required
                onUploadedChange={setFinalReportUploaded}
              />
              <p className="text-xs text-muted-foreground">
                Optional: technical report, photographs, presentation or outcome evidence can be added in Documents → Closure.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <SectionHeading>Consultant Declaration</SectionHeading>
              {CLOSURE_DECLARATION_ITEMS.map((item) => (
                <label key={item.key} htmlFor={`rc-decl-${item.key}`} className="flex items-start gap-3 py-1 text-sm text-foreground">
                  <Checkbox
                    id={`rc-decl-${item.key}`}
                    className="mt-0.5"
                    checked={declaration[item.key] === true}
                    onCheckedChange={(checked) => setDeclaration((d) => ({ ...d, [item.key]: checked === true }))}
                  />
                  <span>
                    {item.text}
                    {errors[`declaration.${item.key}`] && <span className="block text-status-danger-fg">{errors[`declaration.${item.key}`]}</span>}
                  </span>
                </label>
              ))}
            </section>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving || !finalReportUploaded} onClick={handleSubmit}>
              {saving ? "Submitting…" : "Submit Consultancy Closure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
