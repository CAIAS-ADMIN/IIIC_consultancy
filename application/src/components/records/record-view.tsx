import Image from "next/image";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AnyStatus } from "@/lib/status";
import { cellText, type Cell, type RecordBlock, type RecordDocument, type RecordSection } from "@/lib/records/model";

/*
 * Renders a RecordDocument (see lib/records/model) as a page — the on-screen
 * twin of the downloadable PDF (lib/records/pdf), built from the same data.
 */

export function RecordFields({ rows }: { rows: [string, Cell][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[minmax(0,14rem)_1fr] print:grid-cols-[14rem_1fr]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 whitespace-pre-line break-words text-foreground">{cellText(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function RecordTable({ head, rows, label, empty }: { head: string[]; rows: Cell[][]; label?: string; empty?: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty ?? "None recorded."}</p>;
  return (
    // Focusable so keyboard users can scroll a wide table on a narrow screen.
    <div className="overflow-x-auto print:overflow-visible" tabIndex={0} role="region" aria-label={label ?? head[0]}>
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm print:min-w-0">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            {head.map((h) => (
              <th key={h} scope="col" className="py-1.5 pr-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-border align-top last:border-0">
              {head.map((_, j) => (
                <td key={j} className="py-1.5 pr-3 text-foreground">
                  {cellText(cells[j])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A label → amount statement with bold total rows (e.g. the revenue distribution). */
export function RevenueStatement({ head, rows }: { head: [string, string]; rows: { label: string; amount: string; strong?: boolean }[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-background text-xs text-muted-foreground">
            <th scope="col" className="px-3 py-2 text-left font-medium">
              {head[0]}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {head[1]}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={row.strong ? "border-b border-border font-semibold last:border-0" : "border-b border-border last:border-0"}>
              <td className="px-3 py-2 text-foreground">{row.label}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-foreground">{row.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Block({ block }: { block: RecordBlock }) {
  switch (block.kind) {
    case "fields":
      return <RecordFields rows={block.rows} />;
    case "table":
      return <RecordTable head={block.head} rows={block.rows} label={block.label} empty={block.empty} />;
    case "text":
      return (
        <div className="text-sm">
          <p className="font-medium text-foreground">{block.label}</p>
          <p className="whitespace-pre-line text-muted-foreground">{cellText(block.text)}</p>
        </div>
      );
    case "list":
      return (
        <ul className="list-inside list-disc text-sm text-muted-foreground">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "note":
      return <p className="text-xs text-muted-foreground">{block.text}</p>;
    case "statement":
      return <RevenueStatement head={block.head} rows={block.rows} />;
    case "signoff":
      return (
        <div className="flex break-inside-avoid flex-col gap-4 text-sm">
          {block.statement && <p className="text-foreground">{block.statement}</p>}
          {block.lines.map((fields, i) => (
            <div key={i} className="flex flex-wrap gap-x-8 gap-y-4">
              {fields.map((field) => (
                <div key={field.label} className="flex min-w-[14rem] flex-1 items-end gap-2">
                  <span className="shrink-0 font-medium text-foreground">{field.label}:</span>
                  <span className="min-h-6 flex-1 border-b border-foreground/50 px-1 text-foreground">{field.value ?? ""}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    case "card":
      return (
        <div className="break-inside-avoid rounded-md border border-border p-3">
          <p className="mb-2 text-sm font-medium text-foreground">{block.title}</p>
          <div className="flex flex-col gap-2">
            {block.blocks.map((b, i) => (
              <Block key={i} block={b} />
            ))}
          </div>
        </div>
      );
  }
}

/** Just the sections — e.g. the Registration Details panel on the consultancy page. */
export function RecordSectionsView({ sections }: { sections: RecordSection[] }) {
  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <section key={section.title} className="flex break-inside-avoid flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
          {section.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </section>
      ))}
    </div>
  );
}

/** A full record page: the CAIAS / IIIC letterhead, title block and every section. */
export function RecordDocumentView({ record }: { record: RecordDocument }) {
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col items-center gap-3 border-b-2 border-primary pb-4 text-center">
        <Image src="/brand/document-header.png" alt="IIIC · CAIAS — Christ Academy Institute for Advanced Studies" width={360} height={104} priority />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{record.heading}</h1>
          {record.consultancyCode && <p className="mt-1 font-mono text-sm font-semibold text-primary">{record.consultancyCode}</p>}
          <p className="text-sm text-muted-foreground">{record.title}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {record.statuses.map((status) => (
            <StatusBadge key={status} status={status as AnyStatus} />
          ))}
          <span className="text-xs text-muted-foreground">Generated {record.generatedAt.toLocaleString("en-IN")}</span>
        </div>
      </header>
      <RecordSectionsView sections={record.sections} />
    </article>
  );
}
