"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, MasterDataSelect } from "@/components/wizard/field";
import { useToast } from "@/components/ui/use-toast";
import { apiErrorMessage } from "@/lib/api-error";
import { formatInr } from "@/lib/format";
import { APPROVAL_STAGES, APPROVER_ROLES } from "@/lib/validation/approval-config";

type Option = { code: string; label: string };

export type ApprovalConfigRow = {
  id: string;
  stage: string;
  approverRole: string;
  sequence: number;
  isRequired: boolean;
  departmentId: string | null;
  consultancyAreaCode: string | null;
  consultancyCategoryCode: string | null;
  minValue: string | null;
  maxValue: string | null;
  whenResourcesUsed: boolean | null;
  whenIpOrConfidential: boolean | null;
};

const ALL = "__all__";

type FormState = {
  stage: string;
  approverRole: string;
  sequence: string;
  departmentId: string;
  consultancyAreaCode: string;
  consultancyCategoryCode: string;
  minValue: string;
  maxValue: string;
  whenResourcesUsed: string;
  whenIpOrConfidential: string;
};

function toForm(row?: ApprovalConfigRow): FormState {
  return {
    stage: row?.stage ?? "caias_verification_pending",
    approverRole: row?.approverRole ?? "iiic_admin",
    sequence: String(row?.sequence ?? 2),
    departmentId: row?.departmentId ?? ALL,
    consultancyAreaCode: row?.consultancyAreaCode ?? ALL,
    consultancyCategoryCode: row?.consultancyCategoryCode ?? ALL,
    minValue: row?.minValue ?? "",
    maxValue: row?.maxValue ?? "",
    whenResourcesUsed: row?.whenResourcesUsed ? "yes" : "any",
    whenIpOrConfidential: row?.whenIpOrConfidential ? "yes" : "any",
  };
}

const CONDITION_OPTIONS = [
  { code: "any", label: "Regardless" },
  { code: "yes", label: "Only when it applies" },
] as const;

function labelOf(options: readonly Option[], code: string | null): string {
  return options.find((o) => o.code === code)?.label ?? code ?? "";
}

/** Section 50 — CAIAS administrators configure which verification/approval stages apply, to whom, and when. */
export function ApprovalSettingsHub({
  configs,
  departments,
  areas,
  categories,
  canManage,
}: {
  configs: ApprovalConfigRow[];
  departments: Option[];
  areas: Option[];
  categories: Option[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<ApprovalConfigRow | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<ApprovalConfigRow | null>(null);
  const [form, setForm] = React.useState<FormState>(toForm());
  const [saving, setSaving] = React.useState(false);

  function open(row: ApprovalConfigRow | "new") {
    setForm(toForm(row === "new" ? undefined : row));
    setEditing(row);
  }

  function conditions(row: ApprovalConfigRow): string[] {
    const parts: string[] = [];
    parts.push(row.departmentId ? labelOf(departments, row.departmentId) : "All departments");
    if (row.consultancyAreaCode) parts.push(`Area: ${labelOf(areas, row.consultancyAreaCode)}`);
    if (row.consultancyCategoryCode) parts.push(`Category: ${labelOf(categories, row.consultancyCategoryCode)}`);
    if (row.minValue || row.maxValue) {
      parts.push(
        `Value ${row.minValue ? `≥ ${formatInr(Number(row.minValue))}` : ""}${row.minValue && row.maxValue ? " and " : ""}${row.maxValue ? `≤ ${formatInr(Number(row.maxValue))}` : ""}`
      );
    }
    if (row.whenResourcesUsed) parts.push("Only when CAIAS resources are used");
    if (row.whenIpOrConfidential) parts.push("Only when IP / confidential information is involved");
    return parts;
  }

  async function save() {
    setSaving(true);
    try {
      const body = {
        stage: form.stage,
        approverRole: form.approverRole,
        sequence: Number(form.sequence),
        isRequired: true,
        departmentId: form.departmentId === ALL ? null : form.departmentId,
        consultancyAreaCode: form.consultancyAreaCode === ALL ? null : form.consultancyAreaCode,
        consultancyCategoryCode: form.consultancyCategoryCode === ALL ? null : form.consultancyCategoryCode,
        minValue: form.minValue || null,
        maxValue: form.maxValue || null,
        whenResourcesUsed: form.whenResourcesUsed === "yes" ? true : null,
        whenIpOrConfidential: form.whenIpOrConfidential === "yes" ? true : null,
      };
      const isNew = editing === "new";
      const res = await fetch(isNew ? "/api/approval-configs" : `/api/approval-configs/${(editing as ApprovalConfigRow).id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast({ title: "Could not save the rule", description: apiErrorMessage(await res.json().catch(() => ({}))), variant: "destructive" });
        return;
      }
      toast({ title: isNew ? "Approval rule added" : "Approval rule updated", variant: "success" });
      setEditing(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/approval-configs/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast({ title: "Could not remove the rule", description: apiErrorMessage(await res.json().catch(() => ({}))), variant: "destructive" });
        return;
      }
      toast({ title: "Approval rule removed", variant: "success" });
      setDeleting(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const withAll = (options: Option[], allLabel: string) => [{ code: ALL, label: allLabel }, ...options];

  return (
    <div className="flex flex-col gap-4">
      {configs.length === 0 && (
        <div role="status" className="rounded-md bg-accent-soft p-3 text-sm text-accent-soft-foreground">
          No approval stages are configured, so submitted consultancies are registered immediately without any verification. Add at least a CAIAS
          Verification rule.
        </div>
      )}
      {canManage && (
        <Button type="button" className="w-fit gap-1.5" onClick={() => open("new")}>
          <Plus className="h-4 w-4" aria-hidden />
          Add Approval Rule
        </Button>
      )}

      {configs.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No approval rules" description="Rules decide which verification and approval stages a submission goes through." />
      ) : (
        <div className="flex flex-col gap-2">
          {configs.map((row) => (
            <Card key={row.id}>
              <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {row.sequence}. {labelOf(APPROVAL_STAGES, row.stage)}
                    <span className="font-normal text-muted-foreground"> — approved by {labelOf(APPROVER_ROLES, row.approverRole)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{conditions(row).join(" · ")}</p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" variant="ghost" size="icon" aria-label={`Edit rule ${row.sequence}`} onClick={() => open(row)}>
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Remove rule ${row.sequence}`} onClick={() => setDeleting(row)}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add Approval Rule" : "Edit Approval Rule"}</DialogTitle>
            <DialogDescription>Leave a condition on &quot;All&quot; to apply the stage to every consultancy.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Stage" htmlFor="ac-stage" required>
              <MasterDataSelect
                id="ac-stage"
                options={APPROVAL_STAGES.map((s) => ({ code: s.code, label: s.label }))}
                value={form.stage}
                onChange={(v) =>
                  setForm((f) => ({ ...f, stage: v, approverRole: APPROVAL_STAGES.find((s) => s.code === v)?.defaultRole ?? f.approverRole }))
                }
              />
            </Field>
            <Field label="Approver Role" htmlFor="ac-role" required>
              <MasterDataSelect id="ac-role" options={[...APPROVER_ROLES]} value={form.approverRole} onChange={(v) => setForm((f) => ({ ...f, approverRole: v }))} />
            </Field>
            <Field label="Order in Chain" htmlFor="ac-seq" required>
              <Input id="ac-seq" type="number" min="1" max="99" value={form.sequence} onChange={(e) => setForm((f) => ({ ...f, sequence: e.target.value }))} />
            </Field>
            <Field label="Department" htmlFor="ac-dept">
              <MasterDataSelect
                id="ac-dept"
                options={withAll(departments, "All departments")}
                value={form.departmentId}
                onChange={(v) => setForm((f) => ({ ...f, departmentId: v }))}
              />
            </Field>
            <Field label="Consultancy Category" htmlFor="ac-cat">
              <MasterDataSelect
                id="ac-cat"
                options={withAll(categories, "All categories")}
                value={form.consultancyCategoryCode}
                onChange={(v) => setForm((f) => ({ ...f, consultancyCategoryCode: v }))}
              />
            </Field>
            <Field label="Consultancy Area" htmlFor="ac-area">
              <MasterDataSelect
                id="ac-area"
                options={withAll(areas, "All areas")}
                value={form.consultancyAreaCode}
                onChange={(v) => setForm((f) => ({ ...f, consultancyAreaCode: v }))}
              />
            </Field>
            <Field label="Minimum Value (₹)" htmlFor="ac-min">
              <Input id="ac-min" type="number" min="0" value={form.minValue} onChange={(e) => setForm((f) => ({ ...f, minValue: e.target.value }))} />
            </Field>
            <Field label="Maximum Value (₹)" htmlFor="ac-max">
              <Input id="ac-max" type="number" min="0" value={form.maxValue} onChange={(e) => setForm((f) => ({ ...f, maxValue: e.target.value }))} />
            </Field>
            <Field label="Institutional resources used" className="sm:col-span-2">
              <SegmentedChoice
                label="Apply when institutional resources are used"
                options={CONDITION_OPTIONS}
                value={form.whenResourcesUsed}
                onChange={(v) => setForm((f) => ({ ...f, whenResourcesUsed: v }))}
              />
            </Field>
            <Field label="IP or confidential information involved" className="sm:col-span-2">
              <SegmentedChoice
                label="Apply when IP or confidential information is involved"
                options={CONDITION_OPTIONS}
                value={form.whenIpOrConfidential}
                onChange={(v) => setForm((f) => ({ ...f, whenIpOrConfidential: v }))}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving || !form.sequence} onClick={save}>
              {saving ? "Saving…" : "Save Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this approval rule?</DialogTitle>
            <DialogDescription>
              New submissions will no longer go through{" "}
              {deleting ? labelOf(APPROVAL_STAGES, deleting.stage) : "this stage"} under these conditions. The removal is recorded in the audit
              trail.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDeleting(null)}>
              Keep Rule
            </Button>
            <Button type="button" variant="destructive" disabled={saving} onClick={remove}>
              Remove Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
