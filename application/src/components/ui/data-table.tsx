import * as React from "react";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  /** Rendered as the mobile card's title row instead of a labeled line. Exactly one column should set this. */
  primary?: boolean;
};

/**
 * Renders a real `<table>` at `md` and above, and a stacked card list below
 * it — built in from the start per the Phase 0 plan, not bolted on later.
 * Both markups are in the DOM (CSS `hidden`/`md:hidden` toggles which shows),
 * which keeps this SSR-safe with no resize-listener/hydration flicker.
 */
export function DataTable<T>({
  columns,
  data,
  keyFor,
  emptyState,
  className,
}: {
  columns: DataTableColumn<T>[];
  data: T[];
  keyFor: (row: T) => string;
  emptyState?: React.ReactNode;
  className?: string;
}) {
  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const primaryColumn = columns.find((c) => c.primary) ?? columns[0];
  const secondaryColumns = columns.filter((c) => c !== primaryColumn);

  return (
    <div className={className}>
      {/* Desktop / tablet table — scrolls sideways when it has more columns than fit */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              {columns.map((col) => (
                <th key={col.header} className={cn("px-5 py-3 font-medium", col.className)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={keyFor(row)} className="border-b border-border last:border-0">
                {columns.map((col) => (
                  <td key={col.header} className={cn("px-5 py-4 text-foreground", col.className)}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked card list */}
      <ul className="flex flex-col gap-3 md:hidden">
        {data.map((row) => (
          <li key={keyFor(row)} className="rounded-lg border border-border bg-card p-4 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center">
            <div className="text-sm font-semibold text-foreground">{primaryColumn.cell(row)}</div>
            <dl className="mt-2 flex flex-col gap-1.5">
              {secondaryColumns.map((col) => (
                <div key={col.header} className="flex items-center justify-between gap-3 text-sm">
                  <dt className="text-muted-foreground">{col.header}</dt>
                  <dd className="text-foreground">{col.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
