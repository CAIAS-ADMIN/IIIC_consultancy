"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/wizard/field";
import { useToast } from "@/components/ui/use-toast";
import { apiErrorMessage } from "@/lib/api-error";

const emptyForm = { reason: "", amountOutstanding: "", expectedRecoveryAction: "", date: "" };

/**
 * Surfaced inline exactly when the checklist shows the financial gate
 * failing (per the plan's literal task 3), not as a separately-discovered
 * form elsewhere. `finance`/oversight roles only — same role list as the
 * backend's own exception route (finance, hod, iiic_admin,
 * competent_authority, system_admin — no separate "authorising officer"
 * concept exists beyond that role list).
 */
export function ClosureExceptionForm({ consultancyId, closureId }: { consultancyId: string; closureId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState(emptyForm);
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/consultancies/${consultancyId}/closures/${closureId}/exception`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Could not authorise exception", description: apiErrorMessage(body), variant: "destructive" });
        return;
      }
      toast({ title: "Financial exception authorised", variant: "success" });
      setForm(emptyForm);
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Authorise Financial Exception
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount Outstanding (₹)" htmlFor="ce-amount" required>
          <Input id="ce-amount" type="number" min="0" required value={form.amountOutstanding} onChange={(e) => setForm((f) => ({ ...f, amountOutstanding: e.target.value }))} />
        </Field>
        <Field label="Date" htmlFor="ce-date" required>
          <Input id="ce-date" type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        </Field>
      </div>
      <Field label="Reason" htmlFor="ce-reason" required>
        <Textarea id="ce-reason" required value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
      </Field>
      <Field label="Expected Recovery Action" htmlFor="ce-recovery" required>
        <Textarea id="ce-recovery" required value={form.expectedRecoveryAction} onChange={(e) => setForm((f) => ({ ...f, expectedRecoveryAction: e.target.value }))} />
      </Field>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          Authorise
        </Button>
      </div>
    </form>
  );
}
