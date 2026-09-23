"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field } from "@/components/wizard/field";
import { useToast } from "@/components/ui/use-toast";
import { formatInr } from "@/lib/format";
import { apiErrorMessage } from "@/lib/api-error";

export type PaymentAdjustmentRow = { id: string; amount: string; reason: string; createdAt: Date | string };

/**
 * Authorised Adjustments — the mechanism that raises the overpayment
 * ceiling `checkOverpaymentCeiling` enforces (Phase 9). `finance`-only to
 * create, per the backend's exclusive gate; the list itself is read-only
 * context for everyone else.
 */
export function PaymentAdjustmentsPanel({
  consultancyId,
  adjustments,
  canManage,
}: {
  consultancyId: string;
  adjustments: PaymentAdjustmentRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await fetch(`/api/consultancies/${consultancyId}/payment-adjustments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount, reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Could not create adjustment", description: apiErrorMessage(body), variant: "destructive" });
        return;
      }
      toast({ title: "Adjustment authorised", variant: "success" });
      setOpen(false);
      setAmount("");
      setReason("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div id="payment-adjustments-panel" className="flex flex-col gap-3">
      {adjustments.length === 0 && <p className="text-sm text-muted-foreground">No authorised adjustments on record.</p>}
      {adjustments.map((a) => (
        <div key={a.id} className="rounded-md border border-border p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground">{formatInr(Number(a.amount))}</span>
            <span className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</span>
          </div>
          <p className="mt-1 text-muted-foreground">{a.reason}</p>
        </div>
      ))}

      {canManage && (
        <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={() => setOpen(true)}>
          Authorise Adjustment
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Authorise Payment Adjustment</DialogTitle>
            <DialogDescription>Raises the amount this consultancy is allowed to receive beyond its agreement value.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Field label="Amount (₹)" htmlFor="adj-amount" required>
              <Input id="adj-amount" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Reason" htmlFor="adj-reason" required>
              <Textarea id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving || !amount || !reason.trim()} onClick={handleCreate}>
              Authorise
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
