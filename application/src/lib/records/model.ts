/**
 * A consultancy record (Registration / Progress / Closure) described once as
 * plain data. The printable web page and the downloadable PDF both render
 * from this, so the two can never disagree about what a record contains.
 */

export type RecordKind = "registration" | "progress" | "closure";

export type Cell = string | number | null | undefined;

export type RecordBlock =
  /** Label → value pairs. */
  | { kind: "fields"; rows: [string, Cell][] }
  /** A table; `empty` is shown instead when there are no rows. */
  | { kind: "table"; label?: string; head: string[]; rows: Cell[][]; empty?: string }
  /** A labelled paragraph (multi-line text keeps its line breaks). */
  | { kind: "text"; label: string; text: Cell }
  /** A bulleted list. */
  | { kind: "list"; items: string[] }
  /** A small explanatory note. */
  | { kind: "note"; text: string }
  /** A two-column money statement (label → amount); `strong` rows are totals, shown in bold. */
  | { kind: "statement"; head: [string, string]; rows: { label: string; amount: string; strong?: boolean }[] }
  /**
   * A form to complete by hand after printing: optional statement, then lines
   * of fill-in fields ("Signature: ______  Date: ______"). A field with a
   * `value` is pre-filled; the rest print as blank lines.
   */
  | { kind: "signoff"; statement?: string; lines: { label: string; value?: string | null }[][] }
  /** A boxed sub-entry with its own heading, e.g. one progress update. */
  | { kind: "card"; title: string; blocks: RecordBlock[] };

export type RecordSection = { title: string; blocks: RecordBlock[] };

export type RecordDocument = {
  kind: RecordKind;
  /** e.g. "Consultancy Registration Record". */
  heading: string;
  consultancyCode: string | null;
  title: string;
  /** Status codes shown as badges on the page / as text in the PDF. */
  statuses: string[];
  generatedAt: Date;
  sections: RecordSection[];
};

export const RECORD_HEADINGS: Record<RecordKind, string> = {
  registration: "Consultancy Registration Record",
  progress: "Consultancy Progress Record",
  closure: "Consultancy Closure Record",
};

export function isRecordKind(value: string): value is RecordKind {
  return value === "registration" || value === "progress" || value === "closure";
}

/** Shown for an empty value, on screen and in the PDF alike. */
export const EMPTY = "—";

export function cellText(value: Cell): string {
  if (value === null || value === undefined) return EMPTY;
  const text = String(value).trim();
  return text === "" ? EMPTY : text;
}
