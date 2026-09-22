import { cn } from "@/lib/utils";
import { toneClassesFor, humanizeStatus, type AnyStatus } from "@/lib/status";

/**
 * One shared badge for every status/stage value in the app — consultancy
 * status, workflow stage, payment status, milestone/progress status,
 * document status, approval decisions, closure/extension status, and
 * confidentiality level. Never hand-roll a differently-colored badge for a
 * status elsewhere; extend `src/lib/status.ts` instead so the mapping stays
 * in one place.
 */
export function StatusBadge({ status, className }: { status: AnyStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        toneClassesFor(status),
        className
      )}
    >
      {humanizeStatus(status)}
    </span>
  );
}
