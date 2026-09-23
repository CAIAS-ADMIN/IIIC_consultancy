import { AlertTriangle } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";

/** Days elapsed/remaining + overdue flag — always the backend's `getConsultancyDerivedFields` output, never a client-side date computation. */
export function DerivedFieldsStrip({
  daysElapsed,
  daysRemaining,
  isCompletionOverdue,
}: {
  daysElapsed: number | null;
  daysRemaining: number | null;
  isCompletionOverdue: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatTile label="Days Elapsed" value={daysElapsed ?? "—"} />
      <StatTile
        label="Days Remaining"
        value={daysRemaining ?? "—"}
        tone={daysRemaining != null && daysRemaining < 0 ? "danger" : "neutral"}
      />
      {isCompletionOverdue && (
        <div className="flex items-center gap-2 rounded-lg border border-status-danger-fg/30 bg-status-danger-bg p-4 text-status-danger-fg">
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-sm font-medium">Completion Overdue</span>
        </div>
      )}
    </div>
  );
}
