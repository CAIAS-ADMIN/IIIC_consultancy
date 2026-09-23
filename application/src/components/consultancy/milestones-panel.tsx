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
  plannedDate: string;
  actualDate: string | null;
  status: MilestoneStatus;
  responsibleName: string | null;
  remarks: string | null;
};

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
  const [title, setTitle] = React.useState("");
  const [plannedDate, setPlannedDate] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(`/api/consultancies/${consultancyId}/milestones`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, plannedDate }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Could not add milestone", description: apiErrorMessage(body), variant: "destructive" });
        return;
      }
      toast({ title: "Milestone added", variant: "success" });
      setTitle("");
      setPlannedDate("");
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(milestoneId: string, status: MilestoneStatus) {
    setUpdatingId(milestoneId);
    try {
      const res = await fetch(`/api/consultancies/${consultancyId}/milestones/${milestoneId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, actualDate: status === "completed" ? new Date().toISOString().slice(0, 10) : undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Could not update milestone", description: apiErrorMessage(body), variant: "destructive" });
        return;
      }
      router.refresh();
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {canManage && (
        <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4 sm:flex-row sm:items-end">
          <Field label="Milestone Title" htmlFor="ms-title" className="flex-1">
            <Input id="ms-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Planned Date" htmlFor="ms-date" className="sm:w-44">
            <Input id="ms-date" type="date" required value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
          </Field>
          <Button type="submit" disabled={creating}>
            <Plus className="h-4 w-4" aria-hidden />
            Add
          </Button>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {milestones.length === 0 && <p className="text-sm text-muted-foreground">No milestones on record yet.</p>}
        {milestones.map((m) => {
          const overdue = overdueIds.has(m.id);
          return (
            <div
              key={m.id}
              className={cn(
                "flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between",
                overdue && "border-l-4 border-l-status-danger-fg"
              )}
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {m.title}
                  {overdue && <span className="ml-2 text-xs font-semibold text-status-danger-fg">Overdue</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  Planned {m.plannedDate}
                  {m.actualDate && ` · Actual ${m.actualDate}`}
                  {m.responsibleName && ` · ${m.responsibleName}`}
                </p>
                {m.remarks && <p className="mt-1 text-xs text-muted-foreground">{m.remarks}</p>}
              </div>
              {canManage ? (
                <Select value={m.status} onValueChange={(v) => handleStatusChange(m.id, v as MilestoneStatus)} disabled={updatingId === m.id}>
                  <SelectTrigger className="w-40" aria-label={`Status of ${m.title}`}>
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
              ) : (
                <StatusBadge status={m.status} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
