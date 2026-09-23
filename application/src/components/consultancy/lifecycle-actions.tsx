"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field } from "@/components/wizard/field";
import { useToast } from "@/components/ui/use-toast";
import { apiErrorMessage } from "@/lib/api-error";

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, error: apiErrorMessage(json) };
}

/**
 * The role-gated action menu for the four lifecycle transitions (Phase 7).
 * Every button here is only rendered at all when the caller passed the
 * matching `can*` flag as true — computed server-side in the page from the
 * exact same role lists the backend routes themselves enforce — so an
 * unauthorized role never sees so much as a disabled button, per the plan's
 * literal acceptance criterion.
 */
export function LifecycleActions({
  consultancyId,
  status,
  canRequestExtension,
  canManageHold,
  canCancelOrTerminate,
}: {
  consultancyId: string;
  status: string;
  canRequestExtension: boolean;
  canManageHold: boolean;
  canCancelOrTerminate: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  const [extensionOpen, setExtensionOpen] = React.useState(false);
  const [proposedDate, setProposedDate] = React.useState("");
  const [extensionReason, setExtensionReason] = React.useState("");
  const [revisedTimeline, setRevisedTimeline] = React.useState("");
  const [clientConsent, setClientConsent] = React.useState(false);

  const [holdOpen, setHoldOpen] = React.useState(false);
  const [holdReason, setHoldReason] = React.useState("");
  const [holdStartDate, setHoldStartDate] = React.useState("");
  const [expectedResumeDate, setExpectedResumeDate] = React.useState("");

  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelDate, setCancelDate] = React.useState("");
  const [cancelFinancialStatus, setCancelFinancialStatus] = React.useState("");
  const [cancelOutstanding, setCancelOutstanding] = React.useState("");

  const [terminateOpen, setTerminateOpen] = React.useState(false);
  const [terminateReason, setTerminateReason] = React.useState("");
  const [terminationDate, setTerminationDate] = React.useState("");
  const [completedDeliverables, setCompletedDeliverables] = React.useState("");
  const [outstandingDeliverables, setOutstandingDeliverables] = React.useState("");
  const [terminateFinancialStatus, setTerminateFinancialStatus] = React.useState("");
  const [clientCommunication, setClientCommunication] = React.useState("");

  async function run(url: string, body: unknown, onDone: () => void, successTitle: string) {
    setBusy(true);
    const { ok, error } = await post(url, body);
    setBusy(false);
    if (ok) {
      toast({ title: successTitle, variant: "success" });
      onDone();
      router.refresh();
    } else {
      toast({ title: "Action failed", description: error, variant: "destructive" });
    }
  }

  if (!canRequestExtension && !canManageHold && !canCancelOrTerminate) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {canRequestExtension && status === "active" && (
        <Button type="button" variant="secondary" onClick={() => setExtensionOpen(true)}>
          Request Extension
        </Button>
      )}
      {canManageHold && status === "active" && (
        <Button type="button" variant="secondary" onClick={() => setHoldOpen(true)}>
          Put On Hold
        </Button>
      )}
      {canManageHold && status === "on_hold" && (
        <Button
          type="button"
          onClick={() => run(`/api/consultancies/${consultancyId}/resume`, {}, () => {}, "Resumed")}
          disabled={busy}
        >
          Resume
        </Button>
      )}
      {canCancelOrTerminate && (
        <>
          <Button type="button" variant="secondary" onClick={() => setCancelOpen(true)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={() => setTerminateOpen(true)}>
            Terminate
          </Button>
        </>
      )}

      {/* Request Extension */}
      <Dialog open={extensionOpen} onOpenChange={setExtensionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Extension</DialogTitle>
            <DialogDescription>Only one extension request can be pending at a time.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Field label="Proposed Completion Date" htmlFor="ext-date" required>
              <Input id="ext-date" type="date" value={proposedDate} onChange={(e) => setProposedDate(e.target.value)} />
            </Field>
            <Field label="Reason" htmlFor="ext-reason" required>
              <Textarea id="ext-reason" value={extensionReason} onChange={(e) => setExtensionReason(e.target.value)} />
            </Field>
            <Field label="Revised Timeline" htmlFor="ext-timeline">
              <Textarea id="ext-timeline" value={revisedTimeline} onChange={(e) => setRevisedTimeline(e.target.value)} />
            </Field>
            <div className="flex items-center gap-2">
              <Checkbox id="ext-consent" checked={clientConsent} onCheckedChange={(c) => setClientConsent(c === true)} />
              <Label htmlFor="ext-consent" className="text-sm font-normal">
                Client has consented to this extension
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setExtensionOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || !proposedDate || !extensionReason.trim()}
              onClick={() =>
                run(
                  `/api/consultancies/${consultancyId}/extensions`,
                  {
                    proposedCompletionDate: proposedDate,
                    reason: extensionReason,
                    revisedTimeline: revisedTimeline || undefined,
                    clientConsent,
                  },
                  () => setExtensionOpen(false),
                  "Extension requested"
                )
              }
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Put On Hold */}
      <Dialog open={holdOpen} onOpenChange={setHoldOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Put On Hold</DialogTitle>
            <DialogDescription>Progress updates and milestone entry are blocked while on hold.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Field label="Reason" htmlFor="hold-reason" required>
              <Textarea id="hold-reason" value={holdReason} onChange={(e) => setHoldReason(e.target.value)} />
            </Field>
            <Field label="Start Date" htmlFor="hold-start" required>
              <Input id="hold-start" type="date" value={holdStartDate} onChange={(e) => setHoldStartDate(e.target.value)} />
            </Field>
            <Field label="Expected Resume Date" htmlFor="hold-resume">
              <Input id="hold-resume" type="date" value={expectedResumeDate} onChange={(e) => setExpectedResumeDate(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setHoldOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || !holdReason.trim() || !holdStartDate}
              onClick={() =>
                run(
                  `/api/consultancies/${consultancyId}/hold`,
                  { reason: holdReason, startDate: holdStartDate, expectedResumeDate: expectedResumeDate || undefined },
                  () => setHoldOpen(false),
                  "Put on hold"
                )
              }
            >
              Put On Hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Consultancy</DialogTitle>
            <DialogDescription>
              This ends the consultancy without delivery. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Field label="Reason" htmlFor="cancel-reason" required>
              <Textarea id="cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            </Field>
            <Field label="Date" htmlFor="cancel-date" required>
              <Input id="cancel-date" type="date" value={cancelDate} onChange={(e) => setCancelDate(e.target.value)} />
            </Field>
            <Field label="Financial Status" htmlFor="cancel-financial" required>
              <Input
                id="cancel-financial"
                placeholder="e.g. No payments received"
                value={cancelFinancialStatus}
                onChange={(e) => setCancelFinancialStatus(e.target.value)}
              />
            </Field>
            <Field label="Outstanding Obligations" htmlFor="cancel-outstanding">
              <Textarea id="cancel-outstanding" value={cancelOutstanding} onChange={(e) => setCancelOutstanding(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setCancelOpen(false)}>
              Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !cancelReason.trim() || !cancelDate || !cancelFinancialStatus.trim()}
              onClick={() =>
                run(
                  `/api/consultancies/${consultancyId}/cancel`,
                  {
                    reason: cancelReason,
                    date: cancelDate,
                    financialStatus: cancelFinancialStatus,
                    outstandingObligations: cancelOutstanding || undefined,
                  },
                  () => setCancelOpen(false),
                  "Consultancy cancelled"
                )
              }
            >
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Terminate */}
      <Dialog open={terminateOpen} onOpenChange={setTerminateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terminate Consultancy</DialogTitle>
            <DialogDescription>
              This ends the consultancy mid-way, with a record of what was and wasn&apos;t delivered. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Field label="Reason" htmlFor="term-reason" required>
              <Textarea id="term-reason" value={terminateReason} onChange={(e) => setTerminateReason(e.target.value)} />
            </Field>
            <Field label="Actual Termination Date" htmlFor="term-date" required>
              <Input id="term-date" type="date" value={terminationDate} onChange={(e) => setTerminationDate(e.target.value)} />
            </Field>
            <Field label="Completed Deliverables" htmlFor="term-completed">
              <Textarea id="term-completed" value={completedDeliverables} onChange={(e) => setCompletedDeliverables(e.target.value)} />
            </Field>
            <Field label="Outstanding Deliverables" htmlFor="term-outstanding">
              <Textarea id="term-outstanding" value={outstandingDeliverables} onChange={(e) => setOutstandingDeliverables(e.target.value)} />
            </Field>
            <Field label="Financial Status" htmlFor="term-financial" required>
              <Input
                id="term-financial"
                placeholder="e.g. Partially paid"
                value={terminateFinancialStatus}
                onChange={(e) => setTerminateFinancialStatus(e.target.value)}
              />
            </Field>
            <Field label="Client Communication" htmlFor="term-comm">
              <Textarea id="term-comm" value={clientCommunication} onChange={(e) => setClientCommunication(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setTerminateOpen(false)}>
              Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !terminateReason.trim() || !terminationDate || !terminateFinancialStatus.trim()}
              onClick={() =>
                run(
                  `/api/consultancies/${consultancyId}/terminate`,
                  {
                    reason: terminateReason,
                    actualTerminationDate: terminationDate,
                    completedDeliverables: completedDeliverables || undefined,
                    outstandingDeliverables: outstandingDeliverables || undefined,
                    financialStatus: terminateFinancialStatus,
                    clientCommunication: clientCommunication || undefined,
                  },
                  () => setTerminateOpen(false),
                  "Consultancy terminated"
                )
              }
            >
              Confirm Termination
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
