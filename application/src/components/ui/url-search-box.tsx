"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * A search box bound to the `?q=` URL param (resetting to page 1), for
 * server-rendered lists that filter on it — every search is a shareable URL
 * and the back button works. Applies on Enter or when the box loses focus.
 */
export function UrlSearchBox({ id, label, placeholder }: { id: string; label: string; placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const current = searchParams.get("q") ?? "";
  const [q, setQ] = React.useState(current);

  function apply(value: string) {
    const next = value.trim();
    if (next === current) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("q", next);
    else params.delete("q");
    params.delete("page");
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  return (
    <form
      role="search"
      className="relative w-full md:w-80"
      aria-busy={isPending}
      onSubmit={(e) => {
        e.preventDefault();
        apply(q);
      }}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        id={id}
        type="search"
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          // Clearing the box (incl. the browser's ✕) shows everything again straight away.
          if (e.target.value === "") apply("");
        }}
        onBlur={() => apply(q)}
        className="h-11 pl-9 md:h-9"
      />
    </form>
  );
}

