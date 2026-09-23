import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClosureGateItem } from "@/lib/consultancy/closure-gates";

/**
 * One row per gate item, rendering exactly what `checkClosureGates` returned
 * — no re-derived pass/fail logic here, just display. This is what makes
 * the plan's literal acceptance criterion ("matches checkClosureGates
 * output exactly, field for field") true by construction.
 */
export function ClosureGateChecklist({ items }: { items: ClosureGateItem[] }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.key}
          className={cn(
            "flex items-start gap-2 rounded-md border p-3 text-sm",
            item.ok ? "border-status-success-fg/20 bg-status-success-bg" : "border-status-danger-fg/20 bg-status-danger-bg"
          )}
        >
          {item.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-success-fg" aria-hidden />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-danger-fg" aria-hidden />
          )}
          <div>
            <p className={cn("font-medium", item.ok ? "text-status-success-fg" : "text-status-danger-fg")}>{item.label}</p>
            {item.reason && <p className="mt-0.5 text-status-danger-fg">{item.reason}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
