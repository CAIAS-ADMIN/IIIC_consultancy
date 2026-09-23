"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field } from "@/components/wizard/field";
import { DocumentCategoryPanel } from "@/components/documents/document-category-panel";
import { useToast } from "@/components/ui/use-toast";
import type { DeliverableCompletion } from "@/db/schema/enums";
import { apiErrorMessage } from "@/lib/api-error";

const FINAL_REPORT_CATEGORY = "Final Report";

const DELIVERABLE_OPTIONS: { value: DeliverableCompletion; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "partially", label: "Partially" },
  { value: "no", label: "No" },
];

/** Request Closure — reuses Phase 4's document manager for the final report upload, per the plan's literal task 1. */
export function RequestClosureDialog({ consultancyId }: { consultancyId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [finalReportUploaded, setFinalReportUploaded] = React.useState(false);
  const [actualCompletionDate, setActualCompletionDate] = React.useState("");
  const [deliverableCompletionStatus, setDeliverableCompletionStatus] = React.useState<DeliverableCompletion>("yes");
  const [partialReason, setPartialReason] = React.useState("");
  const [finalOutcomes, setFinalOutcomes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit() {
    setSaving(true);
    try {
      const docsRes = await fetch(`/api/consultancies/${consultancyId}/documents?category=${encodeURIComponent(FINAL_REPORT_CATEGORY)}`);
      const docsBody = await docsRes.json().catch(() => ({}));
      if (!docsRes.ok) {
        toast({ title: "Could not check the final report", description: apiErrorMessage(docsBody), variant: "destructive" });
        return;
      }
      const docs: { id: string; status: string }[] = docsBody.data ?? [];
      const finalReport = docs.find((d: { status: string }) => d.status === "available");
      if (!finalReport) {
        toast({ title: "Upload the final report before requesting closure", variant: "destructive" });
        return;
      }

      const res = await fetch(`/api/consultancies/${consultancyId}/closures`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actualCompletionDate,
          deliverableCompletionStatus,
          partialReason: deliverableCompletionStatus === "partially" ? partialReason : undefined,
          finalOutcomes,
          finalReportDocumentId: finalReport.id,
        }),
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Closure</DialogTitle>
            <DialogDescription>The IIIC office will review this against the closure checklist before finalising.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <DocumentCategoryPanel
              consultancyId={consultancyId}
              category={FINAL_REPORT_CATEGORY}
              label="Final Report"
              required
              onUploadedChange={setFinalReportUploaded}
            />
            <Field label="Actual Completion Date" htmlFor="rc-date" required>
              <Input id="rc-date" type="date" value={actualCompletionDate} onChange={(e) => setActualCompletionDate(e.target.value)} />
            </Field>
            <Field label="Deliverable Completion" htmlFor="rc-deliverable" required>
              <Select value={deliverableCompletionStatus} onValueChange={(v) => setDeliverableCompletionStatus(v as DeliverableCompletion)}>
                <SelectTrigger id="rc-deliverable">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERABLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {deliverableCompletionStatus === "partially" && (
              <Field label="Reason" htmlFor="rc-partial-reason" required>
                <Textarea id="rc-partial-reason" value={partialReason} onChange={(e) => setPartialReason(e.target.value)} />
              </Field>
            )}
            <Field label="Final Outcomes" htmlFor="rc-outcomes" required>
              <Textarea id="rc-outcomes" value={finalOutcomes} onChange={(e) => setFinalOutcomes(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                saving ||
                !finalReportUploaded ||
                !actualCompletionDate ||
                !finalOutcomes.trim() ||
                (deliverableCompletionStatus === "partially" && !partialReason.trim())
              }
              onClick={handleSubmit}
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
