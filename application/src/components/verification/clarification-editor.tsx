"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { YesNoToggle } from "@/components/ui/yes-no-toggle";
import { useToast } from "@/components/ui/use-toast";

type FieldDef = { field: string; label: string };
type FieldValue = string | boolean;

/**
 * Shown on a `clarification_required` consultancy: the flagged fields only
 * (the backend's own `PATCH` rejects anything else at this status), each
 * rendered with the right widget for its actual current type (boolean ->
 * Yes/No toggle, everything else -> text) rather than one generic input.
 * Save & Resubmit does the two real calls in sequence — PATCH the flagged
 * fields, then POST resubmit — so both must succeed for the record to
 * actually re-enter verification.
 */
export function ClarificationEditor({
  consultancyId,
  canEdit,
  comments,
  flaggedFields,
  currentValues,
  fieldDefs,
}: {
  consultancyId: string;
  canEdit: boolean;
  comments: string | null;
  flaggedFields: string[];
  currentValues: Record<string, unknown>;
  fieldDefs: FieldDef[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = React.useState<Record<string, FieldValue>>(() => {
    const initial: Record<string, FieldValue> = {};
    for (const field of flaggedFields) {
      const raw = currentValues[field];
      initial[field] = typeof raw === "boolean" ? raw : raw == null ? "" : String(raw);
    }
    return initial;
  });
  const [saving, setSaving] = React.useState(false);

  const labelFor = (field: string) => fieldDefs.find((f) => f.field === field)?.label ?? field;

  async function handleResubmit() {
    setSaving(true);
    try {
      const patchRes = await fetch(`/api/consultancies/${consultancyId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!patchRes.ok) {
        const body = await patchRes.json().catch(() => ({}));
        toast({ title: "Could not save changes", description: String(body.error ?? ""), variant: "destructive" });
        return;
      }
      const resubmitRes = await fetch(`/api/consultancies/${consultancyId}/resubmit`, { method: "POST" });
      if (!resubmitRes.ok) {
        const body = await resubmitRes.json().catch(() => ({}));
        toast({ title: "Saved, but could not resubmit", description: String(body.error ?? ""), variant: "destructive" });
        return;
      }
      toast({ title: "Resubmitted for verification", variant: "success" });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-status-warning-fg/30 bg-status-warning-bg">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning-fg" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-status-warning-fg">Returned for Clarification</p>
            {comments && <p className="mt-1 text-sm text-status-warning-fg">{comments}</p>}
          </div>
        </div>

        {canEdit ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {flaggedFields.map((field) => {
                const value = values[field];
                return (
                  <div key={field} className="flex flex-col gap-1.5">
                    <Label htmlFor={`clarify-${field}`}>{labelFor(field)}</Label>
                    {typeof value === "boolean" ? (
                      <YesNoToggle
                        name={field}
                        value={value}
                        onChange={(v) => setValues((prev) => ({ ...prev, [field]: v }))}
                      />
                    ) : (
                      <Input
                        id={`clarify-${field}`}
                        value={value}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field]: e.target.value }))}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <Button type="button" onClick={handleResubmit} disabled={saving} className="w-fit">
              {saving ? "Resubmitting…" : "Save & Resubmit"}
            </Button>
          </>
        ) : (
          <p className="text-sm text-status-warning-fg">
            Only the record&apos;s owner can edit and resubmit these fields.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
