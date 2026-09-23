"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export type PendingExtension = {
  id: string;
  originalCompletionDate: string;
  proposedCompletionDate: string;
  reason: string;
  clientConsent: boolean;
};

/** Shown to an oversight role while an extension request is pending — original and proposed dates side by side, per the plan's literal task. */
export function ExtensionDecisionPanel({ consultancyId, extension }: { consultancyId: string; extension: PendingExtension }) {
  const router = useRouter();
  const { toast } = useToast();
  const [comments, setComments] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    try {
      const res = await fetch(`/api/consultancies/${consultancyId}/extensions/${extension.id}/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, comments: comments || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({ title: decision === "approve" ? "Extension approved" : "Extension rejected", variant: "success" });
        router.refresh();
      } else {
        toast({ title: "Could not decide", description: String(body.error ?? ""), variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-status-special-fg/30 bg-status-special-bg">
      <CardContent className="flex flex-col gap-3 p-4">
        <p className="text-sm font-medium text-status-special-fg">An extension request is awaiting your decision.</p>
        <div className="grid grid-cols-2 gap-4 rounded-md bg-card p-3">
          <div>
            <p className="text-xs text-muted-foreground">Original Completion Date</p>
            <p className="text-sm font-medium text-foreground">{extension.originalCompletionDate}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Proposed Completion Date</p>
            <p className="text-sm font-medium text-foreground">{extension.proposedCompletionDate}</p>
          </div>
        </div>
        <p className="text-sm text-foreground">{extension.reason}</p>
        <p className="text-xs text-muted-foreground">
          Client consent: {extension.clientConsent ? "Yes" : "Not indicated"}
        </p>
        <Textarea placeholder="Comments (optional)" value={comments} onChange={(e) => setComments(e.target.value)} />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => decide("reject")}>
            Reject
          </Button>
          <Button type="button" disabled={busy} onClick={() => decide("approve")}>
            Approve
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
