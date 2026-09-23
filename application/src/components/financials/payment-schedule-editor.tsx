"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/wizard/field";
import { useToast } from "@/components/ui/use-toast";
import { formatInr } from "@/lib/format";

export type PaymentScheduleRow = { id: string; stageLabel: string; plannedAmount: string; plannedDate: string | null };

const emptyForm = { stageLabel: "", plannedAmount: "", plannedDate: "" };

/** Read-only list for everyone; add/edit form only rendered when `canManage` (finance-only, no oversight override — matches the backend's exclusive gate exactly). */
export function PaymentScheduleEditor({
  consultancyId,
  schedules,
  canManage,
}: {
  consultancyId: string;
  schedules: PaymentScheduleRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [saving, setSaving] = React.useState(false);

  function startEdit(row: PaymentScheduleRow) {
    setEditingId(row.id);
    setAdding(false);
    setForm({ stageLabel: row.stageLabel, plannedAmount: row.plannedAmount, plannedDate: row.plannedDate ?? "" });
  }

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setForm(emptyForm);
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save() {
    setSaving(true);
    try {
      const body = { stageLabel: form.stageLabel, plannedAmount: form.plannedAmount, plannedDate: form.plannedDate || undefined };
      const url = editingId
        ? `/api/consultancies/${consultancyId}/payment-schedules/${editingId}`
        : `/api/consultancies/${consultancyId}/payment-schedules`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const resBody = await res.json().catch(() => ({}));
        toast({ title: "Could not save payment stage", description: JSON.stringify(resBody.error ?? ""), variant: "destructive" });
        return;
      }
      toast({ title: editingId ? "Payment stage updated" : "Payment stage added", variant: "success" });
      cancel();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const isFormOpen = adding || editingId !== null;

  return (
    <div className="flex flex-col gap-3">
      {schedules.length === 0 && !isFormOpen && <p className="text-sm text-muted-foreground">No payment stages planned yet.</p>}
      {schedules.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
          <div>
            <p className="font-medium text-foreground">{row.stageLabel}</p>
            <p className="text-xs text-muted-foreground">{row.plannedDate ?? "No planned date"}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-medium text-foreground">{formatInr(Number(row.plannedAmount))}</span>
            {canManage && (
              <Button type="button" variant="ghost" size="icon" aria-label="Edit" onClick={() => startEdit(row)}>
                <Pencil className="h-4 w-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      ))}

      {canManage && !isFormOpen && (
        <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={startAdd}>
          <Plus className="h-4 w-4" aria-hidden />
          Add Payment Stage
        </Button>
      )}

      {canManage && isFormOpen && (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4 sm:flex-row sm:items-end">
          <Field label="Stage Label" htmlFor="ps-label" className="flex-1">
            <Input id="ps-label" value={form.stageLabel} onChange={(e) => setForm((f) => ({ ...f, stageLabel: e.target.value }))} />
          </Field>
          <Field label="Planned Amount (₹)" htmlFor="ps-amount" className="sm:w-40">
            <Input
              id="ps-amount"
              type="number"
              min="0"
              value={form.plannedAmount}
              onChange={(e) => setForm((f) => ({ ...f, plannedAmount: e.target.value }))}
            />
          </Field>
          <Field label="Planned Date" htmlFor="ps-date" className="sm:w-44">
            <Input id="ps-date" type="date" value={form.plannedDate} onChange={(e) => setForm((f) => ({ ...f, plannedDate: e.target.value }))} />
          </Field>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={cancel}>
              Cancel
            </Button>
            <Button type="button" disabled={saving || !form.stageLabel.trim() || !form.plannedAmount} onClick={save}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
