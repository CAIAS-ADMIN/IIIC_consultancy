"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** An instant "filter as you type" box for lists already loaded on the page. */
export function FilterInput({
  id,
  label,
  placeholder,
  value,
  onChange,
  className,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div role="search" className={cn("relative w-full md:w-72", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input id={id} type="search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 pl-9 md:h-9" />
    </div>
  );
}
