"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/wizard/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/use-toast";
import { apiErrorMessage } from "@/lib/api-error";
import { formatInr } from "@/lib/format";

/**
 * Screen 23 "Finance Confirmation" — Finance's own check of a pending
 * closure's money position. Rendered only for the `finance` role.
 */
export function FinanceClosurePanel({
  consultancyId,
  closure,
  financial,
}: {
  consultancyId: string;
  closure: {
    id: string;
    fullPaymentReceived: boolean | null;
    amountPending: string | null;
    pendingReason: string | null;
    expectedPaymentDate: string | null;
    financeVerificationStatus: string | null;
    financeRemarks: string | null;
  };
  financial: { totalValue: number; totalReceived: number; amountPending: number };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [remarks, setRemarks] = React.useState(closure.financeRemarks ?? "");
  const [saving, setSaving] = React.useState(false);

  async function decide(status: "verified" | "discrepancy") {
    setSaving(true);
    try {
      const res = await fetch(`/api/consultancies/${consultancyId}/closures/${closure.id}/finance-verification`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, remarks: remarks || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Could not save the finance confirmation", description: apiErrorMessage(body), variant: "destructive" });
        return;
      }
      toast({ title: status === "verified" ? "Financial status verified" : "Discrepancy recorded", variant: "success" });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Finance Confirmation</CardTitle>
        {closure.financeVerificationStatus && <StatusBadge status={closure.financeVerificationStatus === "verified" ? "verified" : "returned"} />}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <dl className="grid grid-cols-3 gap-2">
          <div>
            <dt className="text-xs text-muted-foreground">Total Agreement Value</dt>
            <dd className="font-medium text-foreground">{formatInr(financial.totalValue)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Total Received</dt>
            <dd className="font-medium text-foreground">{formatInr(financial.totalReceived)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Balance</dt>
            <dd className="font-medium text-foreground">{formatInr(financial.amountPending)}</dd>
          </div>
        </dl>
        <p className="text-muted-foreground">
          Consultant states full payment {closure.fullPaymentReceived ? "was received." : "was not received"}
          {!closure.fullPaymentReceived &&
            closure.amountPending &&
            ` — ${formatInr(Number(closure.amountPending))} pending${closure.expectedPaymentDate ? `, expected ${closure.expectedPaymentDate}` : ""}${closure.pendingReason ? ` (${closure.pendingReason})` : ""}.`}
        </p>
        <Field label="Finance Remarks" htmlFor="fin-remarks">
          <Input id="fin-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Required when flagging a discrepancy" />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={saving} onClick={() => decide("verified")}>
            Verify Financial Status
          </Button>
          <Button type="button" variant="secondary" disabled={saving || !remarks.trim()} onClick={() => decide("discrepancy")}>
            Flag Discrepancy
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">If a balance remains, closure also needs an authorised financial exception.</p>
      </CardContent>
    </Card>
  );
}
