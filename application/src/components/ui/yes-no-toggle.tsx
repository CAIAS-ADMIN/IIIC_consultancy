"use client";

import { cn } from "@/lib/utils";

export function YesNoToggle({
  value,
  onChange,
  name,
  disabled,
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
  name: string;
  disabled?: boolean;
}) {
  const options: { label: string; val: boolean }[] = [
    { label: "Yes", val: true },
    { label: "No", val: false },
  ];

  return (
    <div role="radiogroup" aria-label={name} className="inline-flex gap-2">
      {options.map((opt) => {
        const selected = value === opt.val;
        return (
          <button
            key={opt.label}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(opt.val)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
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
