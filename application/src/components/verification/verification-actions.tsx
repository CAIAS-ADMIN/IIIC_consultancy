"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { apiErrorMessage } from "@/lib/api-error";

type FieldDef = { field: string; label: string };

async function decide(consultancyId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/consultancies/${consultancyId}/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, error: apiErrorMessage(json) };
}

export function VerificationActions({
  consultancyId,
  flaggableFields,
  compact = false,
  consultancyLabel,
}: {
  consultancyId: string;
  flaggableFields: FieldDef[];
  /** Row-sized Verify / Return buttons for lists (Admin Overview) instead of the detail page's banner. Verify asks for confirmation here, since a list row gives no chance to review first. */
  compact?: boolean;
  /** Shown in the dialogs so it's clear which consultancy is being acted on from a list. */
  consultancyLabel?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [returnOpen, setReturnOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [verifyConfirmOpen, setVerifyConfirmOpen] = React.useState(false);
  const [comments, setComments] = React.useState("");
  const [flagged, setFlagged] = React.useState<string[]>([]);

  async function handleVerify() {
    setBusy(true);
    const { ok, error } = await decide(consultancyId, { decision: "verify" });
    setBusy(false);
    if (ok) {
      toast({ title: "Verified", description: `${consultancyLabel ? `${consultancyLabel} moved` : "Moved"} to the next stage.`, variant: "success" });
      setVerifyConfirmOpen(false);
      router.refresh();
    } else {
      toast({ title: "Could not verify", description: error, variant: "destructive" });
    }
  }

  async function handleReturn() {
    if (!comments.trim() || flagged.length === 0) return;
    setBusy(true);
    const { ok, error } = await decide(consultancyId, { decision: "return", comments, flaggedFields: flagged });
    setBusy(false);
    if (ok) {
      toast({ title: "Returned for clarification", variant: "success" });
      setReturnOpen(false);
      router.refresh();
    } else {
      toast({ title: "Could not return for clarification", description: error, variant: "destructive" });
    }
  }

  async function handleReject() {
    if (!comments.trim()) return;
    setBusy(true);
    const { ok, error } = await decide(consultancyId, { decision: "reject", comments });
    setBusy(false);
    if (ok) {
      toast({ title: "Rejected", variant: "success" });
      setRejectOpen(false);
      router.refresh();
    } else {
      toast({ title: "Could not reject", description: error, variant: "destructive" });
    }
  }

  function toggleFlag(field: string) {
    setFlagged((prev) => (prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]));
  }

  const openReturn = () => {
    setComments("");
    setFlagged([]);
    setReturnOpen(true);
  };

  const dialogs = (
    <>
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return for Clarification</DialogTitle>
            <DialogDescription>
              Select the fields that need correction and add a comment for the faculty member.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Textarea
              placeholder="What needs to change?"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
            <div className="max-h-48 overflow-y-auto rounded-md border border-border p-3">
              <div className="grid grid-cols-2 gap-2">
                {flaggableFields.map((f) => (
                  <div key={f.field} className="flex items-center gap-2">
                    <Checkbox
                      id={`flag-${f.field}`}
                      checked={flagged.includes(f.field)}
                      onCheckedChange={() => toggleFlag(f.field)}
                    />
                    <Label htmlFor={`flag-${f.field}`} className="text-sm font-normal">
                      {f.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            {flagged.length === 0 && <p className="text-xs text-muted-foreground">Select at least one field.</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setReturnOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleReturn} disabled={busy || !comments.trim() || flagged.length === 0}>
              Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Consultancy</DialogTitle>
            <DialogDescription>
              This ends the verification workflow for this consultancy. This cannot be undone — a comment explaining
              why is required.
            </DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason for rejection" value={comments} onChange={(e) => setComments(e.target.value)} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleReject} disabled={busy || !comments.trim()}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={verifyConfirmOpen} onOpenChange={setVerifyConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify {consultancyLabel ?? "consultancy"}?</DialogTitle>
            <DialogDescription>It moves to the next approval stage (or is approved, if this is the last one).</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setVerifyConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleVerify} disabled={busy}>
              {busy ? "Verifying…" : "Verify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (compact) {
    return (
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => setVerifyConfirmOpen(true)} disabled={busy} aria-label={`Verify ${consultancyLabel ?? ""}`.trim()}>
          Verify
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={openReturn} disabled={busy} aria-label={`Return ${consultancyLabel ?? ""} for clarification`.trim()}>
          Return
        </Button>
        {dialogs}
      </div>
    );
  }

  return (
    <Card className="border-primary/40 bg-primary-soft">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm font-medium text-primary-soft-foreground">This consultancy is awaiting your verification.</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setComments("");
              setRejectOpen(true);
            }}
            disabled={busy}
          >
            Reject
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={openReturn}
            disabled={busy}
          >
            Return for Clarification
          </Button>
          <Button type="button" onClick={handleVerify} disabled={busy}>
            {busy ? "Working…" : "Verify"}
          </Button>
        </div>
      </CardContent>

      {dialogs}
    </Card>
  );
}
