import { ChevronDown } from "lucide-react";

/**
 * Zero-JS collapsible section built on native `<details>`/`<summary>` —
 * defaults open (a jump-to-section link elsewhere on the page just needs a
 * plain `<a href="#id">`, no client state to coordinate), works identically
 * on desktop and mobile without duplicating content in the DOM per
 * breakpoint. Tailwind's `group-open:` variant drives the chevron rotation
 * off the element's own native `open` attribute.
 */
export function CollapsibleSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details id={id} open className="group scroll-mt-20 rounded-lg border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="flex flex-col gap-4 border-t border-border p-4">{children}</div>
    </details>
  );
}
