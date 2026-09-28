"use client";

import { cn } from "@/lib/utils";

/** Pill-style single choice (same look as YesNoToggle) for 2–4 short options, e.g. Yes / No / Not Applicable. */
export function SegmentedChoice({
  options,
  value,
  onChange,
  label,
  disabled,
}: {
  options: readonly { code: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  /** Accessible name of the group — the question being answered. */
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value === opt.code;
        return (
          <button
            key={opt.code}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(opt.code)}
            className={cn(
              "min-h-11 rounded-full border px-5 py-1.5 text-sm font-medium transition-colors md:min-h-0 md:px-4",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "disabled:cursor-not-allowed disabled:opacity-50",
              selected
                ? "border-primary bg-primary-soft text-primary-soft-foreground"
                : "border-border bg-card text-muted-foreground hover:border-input-border"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
