"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, PencilLine, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/wizard/field";
import { useToast } from "@/components/ui/use-toast";
import { apiErrorMessage } from "@/lib/api-error";

type Action = "reopen" | "archive" | "unarchive" | "sendBack";

const COPY: Record<Action, { title: string; description: string; confirm: string }> = {
  sendBack: {
    title: "Send back for re-edit?",
    description:
      "The registration returns to draft with every section editable. The faculty member is notified with your reason, and you can also make the corrections yourself. It keeps its Consultancy ID and goes through verification again when re-submitted.",
    confirm: "Send Back to Draft",
  },
  reopen: {
    title: "Reopen this record?",
    description:
      "Reopening is recorded permanently with your name, the reason and the previous status. A rejected record goes back to the verifier who rejected it; a closed record becomes active again.",
    confirm: "Reopen Record",
  },
  archive: {
    title: "Archive this record?",
    description: "Archiving keeps the ID, audit trail, finances and documents intact — the record simply leaves the default working lists.",
    confirm: "Archive Record",
  },
  unarchive: {
    title: "Restore from archive?",
    description: "The record returns to the working lists. This is recorded in the audit trail.",
    confirm: "Restore Record",
  },
};

const TOAST_TITLE: Record<Action, string> = {
  sendBack: "Sent back to draft",
  reopen: "Record reopened",
  archive: "Record archived",
  unarchive: "Record restored",
};

/** CAIAS-admin record actions: Send back for re-edit, explicit Reopen (spec §51.3) and Archive / Restore (spec §68). */
export function RecordAdminActions({
  consultancyId,
  canSendBack = false,
  canReopen,
  canArchive,
  isArchived,
}: {
  consultancyId: string;
  canSendBack?: boolean;
  canReopen: boolean;
  canArchive: boolean;
  isArchived: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [action, setAction] = React.useState<Action | null>(null);
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  if (!canSendBack && !canReopen && !canArchive && !isArchived) return null;

  async function confirm() {
    if (!action) return;
    setSaving(true);
    try {
      const url =
        action === "reopen"
          ? `/api/consultancies/${consultancyId}/reopen`
          : action === "sendBack"
            ? `/api/consultancies/${consultancyId}/send-back`
            : `/api/consultancies/${consultancyId}/archive`;
      const res = await fetch(url, {
        method: action === "unarchive" ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: action === "unarchive" ? undefined : JSON.stringify({ reason }),
      });
      if (!res.ok) {
        toast({ title: "Action failed", description: apiErrorMessage(await res.json().catch(() => ({}))), variant: "destructive" });
        return;
      }
      toast({ title: TOAST_TITLE[action], variant: "success" });
      setAction(null);
      setReason("");
      if (action === "sendBack") {
        router.push(`/consultancies/new?draft=${consultancyId}`);
      } else {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  const needsReason = action === "reopen" || action === "archive" || action === "sendBack";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canSendBack && (
          <Button type="button" variant="secondary" className="gap-1.5" onClick={() => setAction("sendBack")}>
            <PencilLine className="h-4 w-4" aria-hidden />
            Send Back for Re-edit
          </Button>
        )}
        {canReopen && (
          <Button type="button" variant="secondary" className="gap-1.5" onClick={() => setAction("reopen")}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Reopen
          </Button>
        )}
        {canArchive && !isArchived && (
          <Button type="button" variant="secondary" className="gap-1.5" onClick={() => setAction("archive")}>
            <Archive className="h-4 w-4" aria-hidden />
            Archive
          </Button>
        )}
        {isArchived && canArchive && (
          <Button type="button" variant="secondary" className="gap-1.5" onClick={() => setAction("unarchive")}>
            <ArchiveRestore className="h-4 w-4" aria-hidden />
            Restore from Archive
          </Button>
        )}
      </div>

      <Dialog open={action !== null} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          {action && (
            <>
              <DialogHeader>
                <DialogTitle>{COPY[action].title}</DialogTitle>
                <DialogDescription>{COPY[action].description}</DialogDescription>
              </DialogHeader>
              {needsReason && (
                <Field label="Reason" htmlFor="admin-action-reason" required>
                  <Textarea id="admin-action-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>
              )}
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setAction(null)}>
                  Cancel
                </Button>
                <Button type="button" disabled={saving || (needsReason && !reason.trim())} onClick={confirm}>
                  {saving ? "Saving…" : COPY[action].confirm}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
