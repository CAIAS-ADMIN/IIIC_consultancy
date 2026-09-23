"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

/** Maps a keyword in a blocked-reason string to the section anchor a reviewer should jump to fix it — the reasons themselves are plain backend text, not structured codes. */
const JUMP_TARGETS: { match: RegExp; anchor: string; label: string }[] = [
  { match: /agreement|payment terms/i, anchor: "team-agreement", label: "Team & Agreement" },
  { match: /financial|total value/i, anchor: "financials", label: "Financials" },
  { match: /document/i, anchor: "documents", label: "Documents" },
  { match: /start date|completion date/i, anchor: "overview", label: "Overview" },
];

function jumpTargetFor(reason: string) {
  return JUMP_TARGETS.find((t) => t.match.test(reason));
}

export function ActivationPanel({ consultancyId, reasons }: { consultancyId: string; reasons: string[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const blocked = reasons.length > 0;

  async function handleActivate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/consultancies/${consultancyId}/activate`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({ title: "Consultancy activated", variant: "success" });
        router.refresh();
      } else {
        toast({
          title: "Activation blocked",
          description: Array.isArray(body.error?.reasons) ? body.error.reasons.join("; ") : String(body.error ?? ""),
          variant: "destructive",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={blocked ? "border-status-warning-fg/30 bg-status-warning-bg" : "border-primary/40 bg-primary-soft"}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={blocked ? "text-sm font-medium text-status-warning-fg" : "text-sm font-medium text-primary-soft-foreground"}>
            {blocked ? "This consultancy cannot be activated yet." : "This consultancy is registered and ready to activate."}
          </p>
          <Button type="button" onClick={handleActivate} disabled={busy || blocked}>
            {busy ? "Activating…" : "Activate"}
          </Button>
        </div>
        {blocked && (
          <ul className="flex flex-col gap-1.5">
            {reasons.map((reason) => {
              const target = jumpTargetFor(reason);
              return (
                <li key={reason} className="flex items-start gap-2 text-sm text-status-warning-fg">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    {reason}
                    {target && (
                      <>
                        {" — "}
                        <a href={`#${target.anchor}`} className="font-medium underline underline-offset-2">
                          Fix in {target.label} →
                        </a>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
