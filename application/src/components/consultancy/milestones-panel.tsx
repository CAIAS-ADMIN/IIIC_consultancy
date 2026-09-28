"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/wizard/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { MilestoneStatus } from "@/db/schema/enums";
import { apiErrorMessage } from "@/lib/api-error";

const STATUS_OPTIONS: MilestoneStatus[] = ["not_started", "in_progress", "completed", "delayed", "on_hold", "cancelled"];

export type MilestoneRow = {
  id: string;
  title: string;
  description: string | null;
  startDate: string | null;
  plannedDate: string;
  actualStartDate: string | null;
  actualDate: string | null;
  status: MilestoneStatus;
  responsibleName: string | null;
  remarks: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyNew = { title: "", description: "", startDate: "", plannedDate: "", responsiblePerson: "" };

function MilestoneUpdateForm({
  consultancyId,
  milestone,
  onDone,
}: {
  consultancyId: string;
  milestone: MilestoneRow;
  onDone: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = React.useState({
    status: milestone.status,
    actualStartDate: milestone.actualStartDate ?? "",
    actualDate: milestone.actualDate ?? "",
    remarks: milestone.remarks ?? "",
  });
  const [saving, setSaving] = React.useState(false);

  function setStatus(status: MilestoneStatus) {
    setForm((f) => ({
      ...f,
      status,
      // Starting or finishing a milestone fills today's date if none is recorded yet.
      actualStartDate: status !== "not_started" && !f.actualStartDate ? today() : f.actualStartDate,
      actualDate: status === "completed" && !f.actualDate ? today() : f.actualDate,
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/consultancies/${consultancyId}/milestones/${milestone.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: form.status,
          actualStartDate: form.actualStartDate || undefined,
          actualDate: form.actualDate || undefined,
          remarks: form.remarks || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Could not update milestone", description: apiErrorMessage(body), variant: "destructive" });
        return;
      }
      toast({ title: "Milestone updated", variant: "success" });
      onDone();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
      <Field label="Status" htmlFor={`ms-status-${milestone.id}`}>
        <Select value={form.status} onValueChange={(v) => setStatus(v as MilestoneStatus)}>
          <SelectTrigger id={`ms-status-${milestone.id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Remarks" htmlFor={`ms-remarks-${milestone.id}`}>
        <Input id={`ms-remarks-${milestone.id}`} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
      </Field>
      <Field label="Actual Start" htmlFor={`ms-astart-${milestone.id}`}>
        <Input
          id={`ms-astart-${milestone.id}`}
          type="date"
          value={form.actualStartDate}
          onChange={(e) => setForm((f) => ({ ...f, actualStartDate: e.target.value }))}
        />
      </Field>
      <Field label="Actual Completion" htmlFor={`ms-aend-${milestone.id}`}>
        <Input id={`ms-aend-${milestone.id}`} type="date" value={form.actualDate} onChange={(e) => setForm((f) => ({ ...f, actualDate: e.target.value }))} />
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">Upload supporting evidence in Documents → Execution.</p>
    </form>
  );
}

export function MilestonesPanel({
  consultancyId,
  milestones,
  overdueIds,
  canManage,
}: {
  consultancyId: string;
  milestones: MilestoneRow[];
  overdueIds: Set<string>;
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [draft, setDraft] = React.useState(emptyNew);
  const [creating, setCreating] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(`/api/consultancies/${consultancyId}/milestones`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          plannedDate: draft.plannedDate,
          description: draft.description || undefined,
          startDate: draft.startDate || undefined,
          responsiblePerson: draft.responsiblePerson || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Could not add milestone", description: apiErrorMessage(body), variant: "destructive" });
        return;
      }
      toast({ title: "Milestone added", variant: "success" });
      setDraft(emptyNew);
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {canManage && (
        <form onSubmit={handleCreate} className="grid gap-3 rounded-lg border border-dashed border-border p-4 sm:grid-cols-2">
          <Field label="Milestone Title" htmlFor="ms-title" required>
            <Input id="ms-title" required value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
          </Field>
          <Field label="Responsible Person" htmlFor="ms-resp">
            <Input id="ms-resp" value={draft.responsiblePerson} onChange={(e) => setDraft((d) => ({ ...d, responsiblePerson: e.target.value }))} />
          </Field>
          <Field label="Start Date" htmlFor="ms-start">
            <Input id="ms-start" type="date" value={draft.startDate} onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))} />
          </Field>
          <Field label="Expected Completion" htmlFor="ms-date" required>
            <Input id="ms-date" type="date" required value={draft.plannedDate} onChange={(e) => setDraft((d) => ({ ...d, plannedDate: e.target.value }))} />
          </Field>
          <Field label="Description" htmlFor="ms-desc" className="sm:col-span-2">
            <Input id="ms-desc" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
          </Field>
          <Button type="submit" disabled={creating} className="w-fit">
            <Plus className="h-4 w-4" aria-hidden />
            Add Milestone
          </Button>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {milestones.length === 0 && <p className="text-sm text-muted-foreground">No milestones on record yet.</p>}
        {milestones.map((m) => {
          const overdue = overdueIds.has(m.id);
          return (
            <div key={m.id} className={cn("rounded-md border border-border p-3", overdue && "border-l-4 border-l-status-danger-fg")}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {m.title}
                    {overdue && <span className="ml-2 text-xs font-semibold text-status-danger-fg">Overdue</span>}
                  </p>
                  {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
                  <p className="text-xs text-muted-foreground">
                    Planned {m.startDate ? `${m.startDate} → ` : ""}
                    {m.plannedDate}
                    {(m.actualStartDate || m.actualDate) && ` · Actual ${m.actualStartDate ?? "?"} → ${m.actualDate ?? "…"}`}
                    {m.responsibleName && ` · ${m.responsibleName}`}
                  </p>
                  {m.remarks && <p className="mt-1 text-xs text-muted-foreground">Remarks: {m.remarks}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={m.status} />
                  {canManage && editingId !== m.id && (
                    <Button type="button" variant="secondary" size="sm" onClick={() => setEditingId(m.id)} aria-label={`Update ${m.title}`}>
                      Update
                    </Button>
                  )}
                </div>
              </div>
              {canManage && editingId === m.id && (
                <MilestoneUpdateForm consultancyId={consultancyId} milestone={m} onDone={() => setEditingId(null)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
