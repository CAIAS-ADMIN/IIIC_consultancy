"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  required,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-status-danger-fg"> *</span>}
      </Label>
      {children}
      {error && <p className="text-sm text-status-danger-fg">{error}</p>}
    </div>
  );
}

export type MasterDataOption = { code: string; label: string };

/** A Select bound to a master-data category's option list, with a placeholder and controlled value/onChange. */
/** Lists longer than this get a "type to search" box instead of a plain dropdown. */
export const SEARCHABLE_OPTION_THRESHOLD = 7;

export function MasterDataSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Select…",
  disabled,
  searchable,
}: {
  id?: string;
  options: MasterDataOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Force the searchable variant on/off; by default it's used for lists longer than SEARCHABLE_OPTION_THRESHOLD. */
  searchable?: boolean;
}) {
  if (searchable ?? options.length > SEARCHABLE_OPTION_THRESHOLD) {
    return <SearchableSelect id={id} options={options} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} />;
  }
  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.code} value={opt.code}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-foreground">{children}</h2>;
}

/** Multi-select as a wrapping list of labelled checkboxes (Consultancy Domain, IP Type, Resources…). */
export function CheckboxGroup({
  idPrefix,
  options,
  value,
  onChange,
  label,
}: {
  idPrefix: string;
  options: MasterDataOption[];
  value: string[];
  onChange: (value: string[]) => void;
  label: string;
}) {
  function toggle(code: string) {
    onChange(value.includes(code) ? value.filter((v) => v !== code) : [...value, code]);
  }
  return (
    <div role="group" aria-label={label} className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
      {options.map((opt) => (
        <label key={opt.code} htmlFor={`${idPrefix}-${opt.code}`} className="flex min-h-11 items-center gap-2 text-sm md:min-h-8">
          <Checkbox id={`${idPrefix}-${opt.code}`} checked={value.includes(opt.code)} onCheckedChange={() => toggle(opt.code)} />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

/** A bordered, removable row inside a repeating section (team member, deliverable, milestone…). */
export function RepeatingRow({
  title,
  onRemove,
  removeLabel,
  canRemove = true,
  children,
}: {
  title: string;
  onRemove: () => void;
  removeLabel: string;
  canRemove?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {canRemove && (
          <Button type="button" variant="ghost" size="icon" aria-label={removeLabel} onClick={onRemove}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

/** Heading row for a repeating section, with its "+ Add …" button and section-level error. */
export function RepeatingHeader({ title, addLabel, onAdd, error }: { title: string; addLabel: string; onAdd: () => void; error?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <SectionHeading>{title}</SectionHeading>
        <Button type="button" variant="secondary" size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4" aria-hidden />
          {addLabel}
        </Button>
      </div>
      {error && <p className="text-sm text-status-danger-fg">{error}</p>}
    </div>
  );
}
