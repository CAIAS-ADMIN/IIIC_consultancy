import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepperStep = { label: string };

export function Stepper({ steps, currentIndex }: { steps: StepperStep[]; currentIndex: number }) {
  return (
    <div>
      {/* Desktop: numbered circles + connecting line */}
      <ol className="hidden items-center md:flex">
        {steps.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li key={step.label} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    done && "bg-primary text-primary-foreground",
                    active && "bg-primary text-primary-foreground",
                    !done && !active && "bg-status-neutral-bg text-muted-foreground"
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={cn("text-sm font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <span className={cn("mx-3 h-px flex-1", done ? "bg-primary" : "bg-border")} />
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile: progress bar + "Step X of N: label" */}
      <div className="md:hidden">
        <p className="text-sm font-medium text-foreground">
          Step {currentIndex + 1} of {steps.length}: {steps[currentIndex]?.label}
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-status-neutral-bg">
          <div
            className="h-full rounded-pill bg-primary transition-all"
            style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
