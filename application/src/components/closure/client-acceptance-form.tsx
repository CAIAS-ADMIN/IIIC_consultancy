"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/wizard/field";
import { useToast } from "@/components/ui/use-toast";
import { apiErrorMessage } from "@/lib/api-error";

const emptyForm = { acceptedByName: "", acceptanceDate: "" };

/** Records the client-acceptance gate item — nothing else in the app could satisfy this checklist row without it. */
export function ClientAcceptanceForm({ consultancyId }: { consultancyId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = React.useState(emptyForm);
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/consultancies/${consultancyId}/client-acceptance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Could not record client acceptance", description: apiErrorMessage(body), variant: "destructive" });
        return;
      }
      toast({ title: "Client acceptance recorded", variant: "success" });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4 sm:flex-row sm:items-end">
      <Field label="Accepted By" htmlFor="ca-name" className="flex-1">
        <Input id="ca-name" required value={form.acceptedByName} onChange={(e) => setForm((f) => ({ ...f, acceptedByName: e.target.value }))} />
      </Field>
      <Field label="Acceptance Date" htmlFor="ca-date" className="sm:w-44">
        <Input id="ca-date" type="date" required value={form.acceptanceDate} onChange={(e) => setForm((f) => ({ ...f, acceptanceDate: e.target.value }))} />
      </Field>
      <Button type="submit" disabled={saving}>
        Record Client Acceptance
      </Button>
    </form>
  );
}
