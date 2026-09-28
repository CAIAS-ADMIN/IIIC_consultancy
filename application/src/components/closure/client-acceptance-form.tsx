"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { Field } from "@/components/wizard/field";
import { useToast } from "@/components/ui/use-toast";
import { apiErrorMessage } from "@/lib/api-error";
import { RATING_LABELS } from "@/lib/validation/closure";
import { DocumentCategoryPanel } from "@/components/documents/document-category-panel";

const ACCEPTANCE_OPTIONS = [
  { code: "yes", label: "Yes" },
  { code: "no", label: "No" },
  { code: "not_required", label: "Not Required" },
] as const;

const RATING_OPTIONS = Object.entries(RATING_LABELS).map(([value, label]) => ({ code: value, label: `${value} — ${label}` }));

export type AcceptanceRow = {
  id: string;
  acceptanceStatus: string;
  acceptedByName: string | null;
  acceptanceDate: string | null;
  remarks: string | null;
};

export type FeedbackRow = {
  id: string;
  feedbackDate: string;
  rating: number | null;
  comments: string | null;
  suggestions: string | null;
};

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, body: await res.json().catch(() => ({})) };
}

/** Screen 22 — client acceptance (Yes / No / Not Required) and client feedback, with the record of both so far. */
export function ClientFeedbackPanel({
  consultancyId,
  acceptances,
  feedback,
  canRecordAcceptance,
  canRecordFeedback,
  acceptanceRequired,
}: {
  consultancyId: string;
  acceptances: AcceptanceRow[];
  feedback: FeedbackRow[];
  canRecordAcceptance: boolean;
  canRecordFeedback: boolean;
  acceptanceRequired: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [acceptance, setAcceptance] = React.useState({ acceptanceStatus: "yes", acceptedByName: "", acceptanceDate: "", remarks: "" });
  const [fb, setFb] = React.useState({ feedbackDate: new Date().toISOString().slice(0, 10), rating: "", comments: "", suggestions: "" });
  const [saving, setSaving] = React.useState<"acceptance" | "feedback" | null>(null);

  async function saveAcceptance(e: React.FormEvent) {
    e.preventDefault();
    setSaving("acceptance");
    try {
      const { ok, body } = await post(`/api/consultancies/${consultancyId}/client-acceptance`, {
        acceptanceStatus: acceptance.acceptanceStatus,
        acceptedByName: acceptance.acceptedByName || undefined,
        acceptanceDate: acceptance.acceptanceDate || undefined,
        remarks: acceptance.remarks || undefined,
      });
      if (!ok) {
        toast({ title: "Could not record client acceptance", description: apiErrorMessage(body), variant: "destructive" });
        return;
      }
      toast({ title: "Client acceptance recorded", variant: "success" });
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  async function saveFeedback(e: React.FormEvent) {
    e.preventDefault();
    setSaving("feedback");
    try {
      const { ok, body } = await post(`/api/consultancies/${consultancyId}/client-feedback`, {
        feedbackDate: fb.feedbackDate,
        rating: fb.rating ? Number(fb.rating) : undefined,
        comments: fb.comments || undefined,
        suggestions: fb.suggestions || undefined,
      });
      if (!ok) {
        toast({ title: "Could not record feedback", description: apiErrorMessage(body), variant: "destructive" });
        return;
      }
      toast({ title: "Client feedback recorded", variant: "success" });
      setFb((f) => ({ ...f, rating: "", comments: "", suggestions: "" }));
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  const latestAcceptance = acceptances[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-foreground">
          Client Acceptance{" "}
          <span className="font-normal text-muted-foreground">({acceptanceRequired ? "required for closure" : "not required by this registration"})</span>
        </p>
        {latestAcceptance ? (
          <p className="text-sm text-foreground">
            {ACCEPTANCE_OPTIONS.find((o) => o.code === latestAcceptance.acceptanceStatus)?.label ?? latestAcceptance.acceptanceStatus}
            {latestAcceptance.acceptedByName && ` — ${latestAcceptance.acceptedByName}`}
            {latestAcceptance.acceptanceDate && `, ${latestAcceptance.acceptanceDate}`}
            {latestAcceptance.remarks && <span className="block text-muted-foreground">{latestAcceptance.remarks}</span>}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Not recorded yet.</p>
        )}
        {canRecordAcceptance && (
          <form onSubmit={saveAcceptance} className="grid gap-3 rounded-lg border border-dashed border-border p-4 sm:grid-cols-2">
            <Field label="Client Acceptance" required className="sm:col-span-2">
              <SegmentedChoice
                label="Client acceptance"
                options={ACCEPTANCE_OPTIONS}
                value={acceptance.acceptanceStatus}
                onChange={(v) => setAcceptance((a) => ({ ...a, acceptanceStatus: v }))}
              />
            </Field>
            {acceptance.acceptanceStatus === "yes" && (
              <>
                <Field label="Client Representative" htmlFor="ca-name" required>
                  <Input
                    id="ca-name"
                    required
                    value={acceptance.acceptedByName}
                    onChange={(e) => setAcceptance((a) => ({ ...a, acceptedByName: e.target.value }))}
                  />
                </Field>
                <Field label="Client Acceptance Date" htmlFor="ca-date" required>
                  <Input
                    id="ca-date"
                    type="date"
                    required
                    value={acceptance.acceptanceDate}
                    onChange={(e) => setAcceptance((a) => ({ ...a, acceptanceDate: e.target.value }))}
                  />
                </Field>
              </>
            )}
            <Field label="Remarks" htmlFor="ca-remarks" className="sm:col-span-2">
              <Input id="ca-remarks" value={acceptance.remarks} onChange={(e) => setAcceptance((a) => ({ ...a, remarks: e.target.value }))} />
            </Field>
            <Button type="submit" disabled={saving !== null} className="w-fit">
              {saving === "acceptance" ? "Saving…" : "Record Client Acceptance"}
            </Button>
          </form>
        )}
        {(canRecordAcceptance || latestAcceptance) && (
          <DocumentCategoryPanel consultancyId={consultancyId} category="Client Acceptance" label="Acceptance Document" />
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-foreground">Client Feedback</p>
        {feedback.length === 0 ? (
          <p className="text-sm text-muted-foreground">No client feedback recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {feedback.map((f) => (
              <li key={f.id} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium text-foreground">
                  {f.rating ? `${f.rating}/5 — ${RATING_LABELS[f.rating]}` : "No rating"}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{f.feedbackDate}</span>
                </p>
                {f.comments && <p className="mt-1 text-foreground">{f.comments}</p>}
                {f.suggestions && <p className="mt-1 text-muted-foreground">Suggestions: {f.suggestions}</p>}
              </li>
            ))}
          </ul>
        )}
        {canRecordFeedback && (
          <form onSubmit={saveFeedback} className="grid gap-3 rounded-lg border border-dashed border-border p-4 sm:grid-cols-2">
            <Field label="Overall Satisfaction (optional)" className="sm:col-span-2">
              <SegmentedChoice label="Overall satisfaction" options={RATING_OPTIONS} value={fb.rating} onChange={(v) => setFb((f) => ({ ...f, rating: v }))} />
            </Field>
            <Field label="Feedback Date" htmlFor="fb-date" required>
              <Input id="fb-date" type="date" required value={fb.feedbackDate} onChange={(e) => setFb((f) => ({ ...f, feedbackDate: e.target.value }))} />
            </Field>
            <Field label="Comments" htmlFor="fb-comments" className="sm:col-span-2">
              <Textarea id="fb-comments" rows={2} value={fb.comments} onChange={(e) => setFb((f) => ({ ...f, comments: e.target.value }))} />
            </Field>
            <Field label="Suggestions" htmlFor="fb-suggestions" className="sm:col-span-2">
              <Textarea id="fb-suggestions" rows={2} value={fb.suggestions} onChange={(e) => setFb((f) => ({ ...f, suggestions: e.target.value }))} />
            </Field>
            <Button type="submit" disabled={saving !== null} className="w-fit">
              {saving === "feedback" ? "Saving…" : "Record Feedback"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
