"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/wizard/field";
import { useToast } from "@/components/ui/use-toast";
import { formatInr } from "@/lib/format";
import { apiErrorMessage } from "@/lib/api-error";

export type PaymentTransactionRow = {
  id: string;
  amount: string;
  transactionDate: string;
  institutionalAccountRef: string;
  transactionRef: string;
  tdsDeducted: string;
  remarks: string | null;
};

const emptyForm = { amount: "", transactionDate: "", institutionalAccountRef: "", transactionRef: "", tdsDeducted: "", remarks: "" };

/** Read-only transaction history for everyone; the Record Payment form only renders when `canManage` (finance-only, no oversight override). */
export function PaymentTransactionsPanel({
  consultancyId,
  transactions,
  canManage,
}: {
  consultancyId: string;
  transactions: PaymentTransactionRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = React.useState(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [overpaymentError, setOverpaymentError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOverpaymentError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/consultancies/${consultancyId}/payment-transactions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, tdsDeducted: form.tdsDeducted || undefined, remarks: form.remarks || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setOverpaymentError(String(body.error ?? "This payment would exceed the amount allowed."));
        return;
      }
      if (!res.ok) {
        toast({ title: "Could not record payment", description: apiErrorMessage(body), variant: "destructive" });
        return;
      }
      toast({ title: "Payment recorded", variant: "success" });
      setForm(emptyForm);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {canManage && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-dashed border-border p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Amount (₹)" htmlFor="tx-amount" required>
              <Input id="tx-amount" type="number" min="0" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </Field>
            <Field label="Transaction Date" htmlFor="tx-date" required>
              <Input id="tx-date" type="date" required value={form.transactionDate} onChange={(e) => setForm((f) => ({ ...f, transactionDate: e.target.value }))} />
            </Field>
            <Field label="TDS Deducted (₹)" htmlFor="tx-tds">
              <Input id="tx-tds" type="number" min="0" value={form.tdsDeducted} onChange={(e) => setForm((f) => ({ ...f, tdsDeducted: e.target.value }))} />
            </Field>
            <Field label="Institutional Account Ref" htmlFor="tx-account" required>
              <Input id="tx-account" required value={form.institutionalAccountRef} onChange={(e) => setForm((f) => ({ ...f, institutionalAccountRef: e.target.value }))} />
            </Field>
            <Field label="Transaction Ref" htmlFor="tx-ref" required>
              <Input id="tx-ref" required value={form.transactionRef} onChange={(e) => setForm((f) => ({ ...f, transactionRef: e.target.value }))} />
            </Field>
          </div>
          <Field label="Remarks" htmlFor="tx-remarks">
            <Textarea id="tx-remarks" value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
          </Field>

          {overpaymentError && (
            <div className="rounded-md border border-status-danger-fg/30 bg-status-danger-bg p-3 text-sm text-status-danger-fg">
              <p>{overpaymentError}</p>
              <a href="#payment-adjustments-panel" className="mt-1 inline-block font-medium underline underline-offset-2">
                Authorise an Adjustment →
              </a>
            </div>
          )}

          <Button type="submit" disabled={saving} className="w-fit">
            {saving ? "Recording…" : "Record Payment"}
          </Button>
        </form>
      )}

      <div className="flex flex-col gap-2">
        {transactions.length === 0 && <p className="text-sm text-muted-foreground">No payments received yet.</p>}
        {transactions.map((t) => (
          <div key={t.id} className="rounded-md border border-border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{formatInr(Number(t.amount))}</span>
              <span className="text-xs text-muted-foreground">{t.transactionDate}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.institutionalAccountRef} · {t.transactionRef}
              {Number(t.tdsDeducted) > 0 && ` · TDS ${formatInr(Number(t.tdsDeducted))}`}
            </p>
            {t.remarks && <p className="mt-1 text-muted-foreground">{t.remarks}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
