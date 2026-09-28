"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { YesNoToggle } from "@/components/ui/yes-no-toggle";
import { CheckboxGroup } from "@/components/wizard/field";
import { useToast } from "@/components/ui/use-toast";

type FieldDef = { field: string; label: string };
type Option = { code: string; label: string };
type FieldValue = { kind: "boolean"; value: boolean } | { kind: "text"; value: string } | { kind: "codes"; value: string[] } | { kind: "json"; value: string };

/** Code-list fields and the master-data category that labels their options. */
const CODE_LIST_CATEGORIES: Record<string, string> = {
  consultancyDomainCodes: "consultancy_domain",
  ipTypeCodes: "ip_type",
  resourceTypeCodes: "resource_type",
};

function toFieldValue(field: string, raw: unknown): FieldValue {
  if (typeof raw === "boolean") return { kind: "boolean", value: raw };
  if (Array.isArray(raw) && (field in CODE_LIST_CATEGORIES || raw.every((v) => typeof v === "string"))) {
    return { kind: "codes", value: raw as string[] };
  }
  if (raw !== null && typeof raw === "object") return { kind: "json", value: JSON.stringify(raw, null, 2) };
  return { kind: "text", value: raw == null ? "" : String(raw) };
}

/**
 * Shown on a `clarification_required` consultancy: the flagged fields only
 * (the backend's own `PATCH` rejects anything else at this status), each
 * with a widget for its actual type — Yes/No for booleans, a checklist for
 * code lists, JSON for structured lists, text otherwise. Only changed fields
 * are sent; Save & Resubmit PATCHes them, then POSTs resubmit — both must
 * succeed for the record to re-enter verification.
 */
export function ClarificationEditor({
  consultancyId,
  canEdit,
  comments,
  flaggedFields,
  currentValues,
  fieldDefs,
  masterData = {},
}: {
  consultancyId: string;
  canEdit: boolean;
  comments: string | null;
  flaggedFields: string[];
  currentValues: Record<string, unknown>;
  fieldDefs: FieldDef[];
  masterData?: Record<string, Option[]>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const initial = React.useMemo(
    () => Object.fromEntries(flaggedFields.map((field) => [field, toFieldValue(field, currentValues[field])])) as Record<string, FieldValue>,
    [flaggedFields, currentValues]
  );
  const [values, setValues] = React.useState<Record<string, FieldValue>>(initial);
  const [saving, setSaving] = React.useState(false);

  const labelFor = (field: string) => fieldDefs.find((f) => f.field === field)?.label ?? field;
  const set = (field: string, value: FieldValue) => setValues((prev) => ({ ...prev, [field]: value }));

  function changedPayload(): Record<string, unknown> | string {
    const payload: Record<string, unknown> = {};
    for (const field of flaggedFields) {
      const now = values[field];
      if (JSON.stringify(now) === JSON.stringify(initial[field])) continue;
      if (now.kind === "json") {
        try {
          payload[field] = JSON.parse(now.value);
        } catch {
          return `${labelFor(field)} is not valid JSON`;
        }
      } else if (now.kind === "text") {
        // An emptied optional field is cleared, not stored as "".
        payload[field] = now.value.trim() === "" ? null : now.value;
      } else {
        payload[field] = now.value;
      }
    }
    return payload;
  }

  async function handleResubmit() {
    const payload = changedPayload();
    if (typeof payload === "string") {
      toast({ title: "Check the highlighted field", description: payload, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (Object.keys(payload).length > 0) {
        const patchRes = await fetch(`/api/consultancies/${consultancyId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!patchRes.ok) {
          const body = await patchRes.json().catch(() => ({}));
          toast({ title: "Could not save changes", description: String(body.error ?? ""), variant: "destructive" });
          return;
        }
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
                const wide = value.kind === "codes" || value.kind === "json";
                return (
                  <div key={field} className={wide ? "flex flex-col gap-1.5 sm:col-span-2" : "flex flex-col gap-1.5"}>
                    <Label htmlFor={`clarify-${field}`}>{labelFor(field)}</Label>
                    {value.kind === "boolean" && (
                      <YesNoToggle name={labelFor(field)} value={value.value} onChange={(v) => set(field, { kind: "boolean", value: v })} />
                    )}
                    {value.kind === "codes" && (
                      <CheckboxGroup
                        idPrefix={`clarify-${field}`}
                        label={labelFor(field)}
                        options={
                          masterData[CODE_LIST_CATEGORIES[field]] ??
                          value.value.map((code) => ({ code, label: code }))
                        }
                        value={value.value}
                        onChange={(v) => set(field, { kind: "codes", value: v })}
                      />
                    )}
                    {value.kind === "json" && (
                      <Textarea
                        id={`clarify-${field}`}
                        rows={6}
                        className="font-mono text-xs"
                        value={value.value}
                        onChange={(e) => set(field, { kind: "json", value: e.target.value })}
                      />
                    )}
                    {value.kind === "text" && (
                      <Input id={`clarify-${field}`} value={value.value} onChange={(e) => set(field, { kind: "text", value: e.target.value })} />
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
          <p className="text-sm text-status-warning-fg">Only the record&apos;s owner can edit and resubmit these fields.</p>
        )}
      </CardContent>
    </Card>
  );
}
