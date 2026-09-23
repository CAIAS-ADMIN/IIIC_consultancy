import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Parses a `?page=` search param into a 1-based page, clamped to `pageCount` — a hand-edited URL never errors. */
export function parsePage(raw: string | string[] | undefined, pageCount: number): number {
  const value = Number.parseInt(Array.isArray(raw) ? raw[0] : (raw ?? "1"), 10);
  return Math.min(Math.max(1, pageCount), Math.max(1, Number.isFinite(value) ? value : 1));
}

/**
 * Link-based pager for server-rendered lists (no client JS, works with the
 * back button, every page is a real URL). Renders nothing for a single page.
 */
export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  const pager = (target: number, label: string, rel: "prev" | "next", enabled: boolean) =>
    enabled ? (
      <Button asChild variant="secondary">
        <Link href={hrefFor(target)} rel={rel}>
          {label}
        </Link>
      </Button>
    ) : (
      <Button variant="secondary" disabled>
        {label}
      </Button>
    );

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
      <span className="text-muted-foreground">
        Showing {((page - 1) * pageSize + 1).toLocaleString("en-IN")}–{Math.min(page * pageSize, total).toLocaleString("en-IN")} of{" "}
        {total.toLocaleString("en-IN")}
      </span>
      <div className="flex items-center gap-2">
        {pager(page - 1, "← Previous", "prev", page > 1)}
        <span className="px-2 text-muted-foreground" aria-current="page">
          {page} / {pageCount}
        </span>
        {pager(page + 1, "Next →", "next", page < pageCount)}
      </div>
    </nav>
  );
}
