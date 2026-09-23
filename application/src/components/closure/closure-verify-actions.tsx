"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

type Decision = "verified" | "clarification_required" | "returned";

const DECISION_LABELS: Record<Decision, string> = {
  verified: "Verified",
  clarification_required: "Clarification Required",
  returned: "Returned",
};

/** IIIC/admin-only closure decision, each of the three outcomes requiring its own comment before it can be submitted (per the plan's literal task 4). */
export function ClosureVerifyActions({ consultancyId, closureId, gateOk }: { consultancyId: string; closureId: string; gateOk: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [openDecision, setOpenDecision] = React.useState<Decision | null>(null);
  const [comments, setComments] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(decision: Decision) {
    setBusy(true);
    try {
      const res = await fetch(`/api/consultancies/${consultancyId}/closures/${closureId}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, comments }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({ title: DECISION_LABELS[decision], variant: "success" });
        setOpenDecision(null);
        setComments("");
        router.refresh();
      } else {
        const reasons = Array.isArray(body.error?.reasons) ? body.error.reasons.join("; ") : String(body.error ?? "");
        toast({ title: "Closure blocked", description: reasons, variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-status-special-fg/30 bg-status-special-bg">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm font-medium text-status-special-fg">
          This closure request is awaiting your decision.
          {!gateOk && " The checklist below shows what's still blocking Verified."}
        </p>
        <div className="flex flex-wrap gap-2">
          {(["returned", "clarification_required", "verified"] as Decision[]).map((decision) => (
            <Button
              key={decision}
              type="button"
              variant={decision === "verified" ? "secondary" : "secondary"}
              onClick={() => {
                setComments("");
                setOpenDecision(decision);
              }}
            >
              {DECISION_LABELS[decision]}
            </Button>
          ))}
        </div>
      </CardContent>

      <Dialog open={openDecision !== null} onOpenChange={(v) => !v && setOpenDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{openDecision ? DECISION_LABELS[openDecision] : ""}</DialogTitle>
            <DialogDescription>
              {openDecision === "verified"
                ? "This finalises the consultancy as Completed & Closed, if the checklist passes."
                : "A comment is required so the requester knows what to fix."}
            </DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Comments" value={comments} onChange={(e) => setComments(e.target.value)} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpenDecision(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || (openDecision !== "verified" && !comments.trim())}
              onClick={() => openDecision && submit(openDecision)}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
