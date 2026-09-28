"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/wizard/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/use-toast";
import type { ProgressStatus } from "@/db/schema/enums";
import { apiErrorMessage } from "@/lib/api-error";

const STATUS_OPTIONS: ProgressStatus[] = ["on_track", "delayed", "on_hold", "completed"];

export type ProgressUpdateRow = {
  id: string;
  reportDate: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  status: ProgressStatus;
  overallProgressPercent: number;
  workCompleted: string | null;
  workInProgress: string | null;
  pendingActivities: string | null;
  challenges: string | null;
  correctiveAction: string | null;
  nextPlannedActivity: string | null;
};

/** Screen 17's optional narrative fields, in display order. */
const OPTIONAL_FIELDS = [
  ["pendingActivities", "Pending Activities"],
  ["challenges", "Challenges / Issues"],
  ["correctiveAction", "Corrective Action"],
  ["nextPlannedActivity", "Next Planned Activity"],
] as const;

const emptyForm = {
  reportDate: "",
  reportingPeriodStart: "",
  reportingPeriodEnd: "",
  status: "on_track" as ProgressStatus,
  overallProgressPercent: "",
  workCompleted: "",
  workInProgress: "",
  pendingActivities: "",
  challenges: "",
  correctiveAction: "",
  nextPlannedActivity: "",
};

export function ProgressUpdatesPanel({
  consultancyId,
  updates,
  canRecord,
}: {
  consultancyId: string;
  updates: ProgressUpdateRow[];
  canRecord: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = React.useState(emptyForm);
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/consultancies/${consultancyId}/progress-updates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          overallProgressPercent: Number(form.overallProgressPercent),
          pendingActivities: form.pendingActivities || undefined,
          challenges: form.challenges || undefined,
          correctiveAction: form.correctiveAction || undefined,
          nextPlannedActivity: form.nextPlannedActivity || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Could not record progress", description: apiErrorMessage(body), variant: "destructive" });
        return;
      }
      toast({ title: "Progress recorded", variant: "success" });
      setForm(emptyForm);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {canRecord && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-dashed border-border p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Report Date" htmlFor="pu-report-date" required>
              <Input
                id="pu-report-date"
                type="date"
                required
                value={form.reportDate}
                onChange={(e) => setForm((f) => ({ ...f, reportDate: e.target.value }))}
              />
            </Field>
            <Field label="Period Start" htmlFor="pu-period-start" required>
              <Input
                id="pu-period-start"
                type="date"
                required
                value={form.reportingPeriodStart}
                onChange={(e) => setForm((f) => ({ ...f, reportingPeriodStart: e.target.value }))}
              />
            </Field>
            <Field label="Period End" htmlFor="pu-period-end" required>
              <Input
                id="pu-period-end"
                type="date"
                required
                value={form.reportingPeriodEnd}
                onChange={(e) => setForm((f) => ({ ...f, reportingPeriodEnd: e.target.value }))}
              />
            </Field>
            <Field label="Status" htmlFor="pu-status" required>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as ProgressStatus }))}>
                <SelectTrigger id="pu-status">
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
            <Field label="Overall Progress (%)" htmlFor="pu-percent" required>
              <Input
                id="pu-percent"
                type="number"
                min="0"
                max="100"
                required
                value={form.overallProgressPercent}
                onChange={(e) => setForm((f) => ({ ...f, overallProgressPercent: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Work Completed" htmlFor="pu-completed" required>
            <Textarea
              id="pu-completed"
              required
              value={form.workCompleted}
              onChange={(e) => setForm((f) => ({ ...f, workCompleted: e.target.value }))}
            />
          </Field>
          <Field label="Work In Progress" htmlFor="pu-inprogress" required>
            <Textarea
              id="pu-inprogress"
              required
              value={form.workInProgress}
              onChange={(e) => setForm((f) => ({ ...f, workInProgress: e.target.value }))}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            {OPTIONAL_FIELDS.map(([key, label]) => (
              <Field key={key} label={label} htmlFor={`pu-${key}`}>
                <Textarea id={`pu-${key}`} rows={2} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
              </Field>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Attach progress reports, meeting minutes, deliverables or client communication in Documents → Execution.
          </p>
          <Button type="submit" disabled={saving} className="w-fit">
            {saving ? "Saving…" : "Record Progress Update"}
          </Button>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {updates.length === 0 && <p className="text-sm text-muted-foreground">No progress updates recorded yet.</p>}
        {[...updates].reverse().map((u) => (
          <div key={u.id} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">{u.reportDate}</span>
              <div className="flex items-center gap-2">
                <StatusBadge status={u.status} />
                <span className="text-sm text-muted-foreground">{u.overallProgressPercent}%</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Period: {u.reportingPeriodStart} – {u.reportingPeriodEnd}
            </p>
            <dl className="mt-2 flex flex-col gap-1 text-sm">
              {(
                [
                  ["Work Completed", u.workCompleted],
                  ["Work In Progress", u.workInProgress],
                  ...OPTIONAL_FIELDS.map(([key, label]) => [label, u[key]] as const),
                ] as const
              )
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                    <dd className="whitespace-pre-line text-foreground">{value}</dd>
                  </div>
                ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
