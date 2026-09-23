import { PauseCircle, XOctagon } from "lucide-react";

/** Unmistakable on-hold banner — the plan's task 2 wants it impossible to miss that progress/milestone entry is currently blocked. */
export function OnHoldBanner({ reason, expectedResumeDate }: { reason: string; expectedResumeDate: string | null }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-status-warning-fg/30 bg-status-warning-bg p-4">
      <PauseCircle className="mt-0.5 h-5 w-5 shrink-0 text-status-warning-fg" aria-hidden />
      <div>
        <p className="text-sm font-semibold text-status-warning-fg">
          This consultancy is on hold — progress updates and milestones are blocked until it resumes.
        </p>
        <p className="mt-1 text-sm text-status-warning-fg">{reason}</p>
        {expectedResumeDate && <p className="mt-1 text-xs text-status-warning-fg">Expected resume: {expectedResumeDate}</p>}
      </div>
    </div>
  );
}

const TERMINAL_LABELS: Record<string, string> = {
  cancelled: "This consultancy was cancelled.",
  terminated: "This consultancy was terminated.",
};

/** A cancelled/terminated consultancy's terminal state, communicated clearly while the rest of the page stays fully readable. */
export function TerminalStateBanner({ status, reason, date }: { status: string; reason: string; date: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-status-danger-fg/30 bg-status-danger-bg p-4">
      <XOctagon className="mt-0.5 h-5 w-5 shrink-0 text-status-danger-fg" aria-hidden />
      <div>
        <p className="text-sm font-semibold text-status-danger-fg">
          {TERMINAL_LABELS[status] ?? "This consultancy has ended."} ({date})
        </p>
        <p className="mt-1 text-sm text-status-danger-fg">{reason}</p>
      </div>
    </div>
  );
}
