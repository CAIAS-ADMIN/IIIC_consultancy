import path from "node:path";
import PDFDocument from "pdfkit";
import { humanizeStatus } from "@/lib/status";
import { cellText, type Cell, type RecordBlock, type RecordDocument } from "./model";

/*
 * Renders a RecordDocument (see ./model) as an A4 PDF: the CAIAS / IIIC
 * header on every page, the record's title block, then each section with
 * label/value rows, tables (header row repeated after a page break),
 * paragraphs, lists and notes; "Page x of y" footer.
 *
 * Body text uses Geist (it has ₹, →, dashes…); headings and labels use the
 * built-in Helvetica-Bold, so those strings are kept to Latin-1.
 */

const HEADER_IMAGE = path.join(process.cwd(), "public", "brand", "document-header.png");
const BODY_FONT = path.join(process.cwd(), "src", "lib", "records", "fonts", "Geist-Regular.ttf");

const PAGE = { size: "A4" as const, margin: 40 };
// Letterhead band: logo, breathing room, a rule, then more room before content.
const LOGO_TOP = 22;
const LOGO_WIDTH = 220;
const LOGO_HEIGHT = (LOGO_WIDTH * 347) / 1200; // document-header.png is 1200 × 347
const HEADER_RULE_Y = LOGO_TOP + LOGO_HEIGHT + 14;
const CONTENT_TOP = HEADER_RULE_Y + 18;
const FOOTER_HEIGHT = 28;
/** Vertical room per hand-filled line in a sign-off block (enough for a signature). */
const SIGNOFF_LINE_GAP = 32;

const COLOR = {
  text: "#1a1f1a",
  muted: "#6b7075",
  primary: "#2e7d32",
  border: "#d8d4c6",
  headerFill: "#f1f0ec",
  cardFill: "#f7f6f1",
};

const SIZE = { title: 16, section: 11.5, body: 9.5, small: 8.5, table: 8.5 };

/** Helvetica-Bold only covers Latin-1; swap the few typographic characters we use for safe equivalents. */
function latin(text: string): string {
  return text
    .replace(/[–—]/g, "-")
    .replace(/→/g, "->")
    .replace(/₹/g, "Rs. ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x00-\xff]/g, "?");
}

export async function renderRecordPdf(record: RecordDocument): Promise<Buffer> {
  const doc = new PDFDocument({ size: PAGE.size, margin: PAGE.margin, bufferPages: true, autoFirstPage: false, info: { Title: `${record.heading} ${record.consultancyCode ?? ""}`.trim(), Author: "CAIAS Consultancy Portal" } });
  doc.registerFont("Body", BODY_FONT);

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const left = PAGE.margin;
  const width = () => doc.page.width - PAGE.margin * 2;
  const bottom = () => doc.page.height - PAGE.margin - FOOTER_HEIGHT;

  // Every page starts with the logo band; content begins below it.
  doc.on("pageAdded", () => {
    doc.image(HEADER_IMAGE, (doc.page.width - LOGO_WIDTH) / 2, LOGO_TOP, { width: LOGO_WIDTH });
    doc.moveTo(left, HEADER_RULE_Y).lineTo(doc.page.width - PAGE.margin, HEADER_RULE_Y).lineWidth(0.8).strokeColor(COLOR.primary).stroke();
    doc.x = left;
    doc.y = CONTENT_TOP;
  });

  const ensureSpace = (height: number) => {
    if (doc.y + height > bottom()) doc.addPage();
  };

  const body = (size = SIZE.body, color = COLOR.text) => doc.font("Body").fontSize(size).fillColor(color);
  const bold = (size = SIZE.body, color = COLOR.text) => doc.font("Helvetica-Bold").fontSize(size).fillColor(color);

  doc.addPage();

  // ---- Title block ----
  bold(SIZE.title, COLOR.text).text(latin(record.heading), left, doc.y, { width: width(), align: "center" });
  doc.moveDown(0.25);
  if (record.consultancyCode) {
    bold(11, COLOR.primary).text(latin(record.consultancyCode), { width: width(), align: "center" });
  }
  body(10.5).text(record.title, { width: width(), align: "center" });
  doc.moveDown(0.3);
  body(SIZE.small, COLOR.muted).text(
    `Status: ${record.statuses.map(humanizeStatus).join(" · ")}   ·   Generated ${record.generatedAt.toLocaleString("en-IN")}`,
    { width: width(), align: "center" }
  );
  doc.moveDown(1);

  // ---- Blocks ----
  const LABEL_WIDTH = 165;
  const GAP = 10;

  function fields(rows: [string, Cell][], x = left, w = width()) {
    const valueWidth = w - LABEL_WIDTH - GAP;
    for (const [label, value] of rows) {
      const text = cellText(value);
      bold(SIZE.body, COLOR.muted);
      const labelHeight = doc.heightOfString(latin(label), { width: LABEL_WIDTH });
      body();
      const valueHeight = doc.heightOfString(text, { width: valueWidth });
      const rowHeight = Math.max(labelHeight, valueHeight) + 4;
      ensureSpace(rowHeight);
      const y = doc.y;
      bold(SIZE.small + 0.5, COLOR.muted).text(latin(label), x, y, { width: LABEL_WIDTH });
      body().text(text, x + LABEL_WIDTH + GAP, y, { width: valueWidth });
      doc.x = x;
      doc.y = y + rowHeight;
    }
  }

  function paragraph(label: string, text: Cell) {
    bold(SIZE.body);
    ensureSpace(doc.heightOfString(latin(label)) + 16);
    doc.text(latin(label), left, doc.y, { width: width() });
    body(SIZE.body, COLOR.text).text(cellText(text), { width: width() });
    doc.moveDown(0.5);
  }

  function list(items: string[]) {
    for (const item of items) {
      body();
      const h = doc.heightOfString(item, { width: width() - 14 });
      ensureSpace(h + 3);
      const y = doc.y;
      body().text("•", left + 2, y);
      body().text(item, left + 14, y, { width: width() - 14 });
      doc.x = left;
      doc.y = y + h + 3;
    }
    doc.moveDown(0.3);
  }

  function note(text: string) {
    body(SIZE.small, COLOR.muted);
    ensureSpace(doc.heightOfString(text, { width: width() }) + 4);
    doc.text(text, left, doc.y, { width: width() });
    doc.moveDown(0.4);
  }

  function table(head: string[], rows: Cell[][], empty?: string) {
    if (rows.length === 0) {
      note(empty ?? "None recorded.");
      return;
    }
    const pad = 4;
    const texts = rows.map((r) => head.map((_, i) => cellText(r[i])));
    // Column widths: proportional to the longest content (capped), never narrower than the heading needs.
    const weights = head.map((h, i) => {
      const longest = Math.max(h.length, ...texts.map((r) => Math.min(r[i].length, 60)));
      return Math.max(6, longest);
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const widths = weights.map((w) => (w / totalWeight) * width());

    const headerHeight = () => {
      bold(SIZE.table);
      return Math.max(...head.map((h, i) => doc.heightOfString(latin(h), { width: widths[i] - pad * 2 }))) + pad * 2;
    };
    const drawHeader = () => {
      const h = headerHeight();
      const y = doc.y;
      doc.rect(left, y, width(), h).fillColor(COLOR.headerFill).fill();
      let x = left;
      head.forEach((label, i) => {
        bold(SIZE.table, COLOR.muted).text(latin(label), x + pad, y + pad, { width: widths[i] - pad * 2 });
        x += widths[i];
      });
      doc.rect(left, y, width(), h).lineWidth(0.5).strokeColor(COLOR.border).stroke();
      doc.y = y + h;
    };

    ensureSpace(headerHeight() + 20);
    drawHeader();
    for (const row of texts) {
      body(SIZE.table);
      const h = Math.max(...row.map((cell, i) => doc.heightOfString(cell, { width: widths[i] - pad * 2 }))) + pad * 2;
      if (doc.y + h > bottom()) {
        doc.addPage();
        drawHeader();
      }
      const y = doc.y;
      let x = left;
      row.forEach((cell, i) => {
        body(SIZE.table).text(cell, x + pad, y + pad, { width: widths[i] - pad * 2 });
        x += widths[i];
      });
      // cell borders
      doc.rect(left, y, width(), h).lineWidth(0.5).strokeColor(COLOR.border).stroke();
      let vx = left;
      for (let i = 0; i < widths.length - 1; i++) {
        vx += widths[i];
        doc.moveTo(vx, y).lineTo(vx, y + h).lineWidth(0.5).strokeColor(COLOR.border).stroke();
      }
      doc.x = left;
      doc.y = y + h;
    }
    doc.moveDown(0.6);
  }

  function statement(head: [string, string], rows: { label: string; amount: string; strong?: boolean }[]) {
    const pad = 5;
    const amountWidth = 140;
    const labelWidth = width() - amountWidth;
    // Totals: shaded row + faux-bold (fill and a hairline stroke) — the body font has no bold weight,
    // and Helvetica-Bold can't draw the ₹ inside labels such as "40% of ₹1,90,000".
    const write = (text: string, x: number, y: number, w: number, strong: boolean, align: "left" | "right") => {
      body(SIZE.body, COLOR.text);
      if (strong) doc.lineWidth(0.35).strokeColor(COLOR.text);
      doc.text(text, x, y, { width: w, align, fill: true, stroke: strong });
    };
    const drawRow = (label: string, amount: string, kind: "header" | "strong" | "normal") => {
      body(SIZE.body);
      const h = Math.max(doc.heightOfString(label, { width: labelWidth - pad * 2 }), doc.heightOfString(amount, { width: amountWidth - pad * 2 })) + pad * 2;
      ensureSpace(h);
      const y = doc.y;
      if (kind !== "normal") doc.rect(left, y, width(), h).fillColor(kind === "header" ? COLOR.headerFill : COLOR.cardFill).fill();
      if (kind === "header") {
        bold(SIZE.table, COLOR.muted).text(latin(label), left + pad, y + pad, { width: labelWidth - pad * 2 });
        bold(SIZE.table, COLOR.muted).text(latin(amount), left + labelWidth + pad, y + pad, { width: amountWidth - pad * 2, align: "right" });
      } else {
        write(label, left + pad, y + pad, labelWidth - pad * 2, kind === "strong", "left");
        write(amount, left + labelWidth + pad, y + pad, amountWidth - pad * 2, kind === "strong", "right");
      }
      doc.rect(left, y, width(), h).lineWidth(0.5).strokeColor(COLOR.border).stroke();
      doc.moveTo(left + labelWidth, y).lineTo(left + labelWidth, y + h).lineWidth(0.5).strokeColor(COLOR.border).stroke();
      doc.x = left;
      doc.y = y + h;
    };
    // Keep the statement together on one page when it fits.
    ensureSpace(22 * (rows.length + 1));
    drawRow(head[0], head[1], "header");
    for (const row of rows) drawRow(row.label, row.amount, row.strong ? "strong" : "normal");
    doc.moveDown(0.6);
  }

  /** Fill-in lines to complete by hand: "Label: ________" (pre-filled values sit on the line). */
  function signoff(statement: string | undefined, lines: { label: string; value?: string | null }[][]) {
    if (statement) {
      body(SIZE.body);
      doc.text(statement, left, doc.y, { width: width() });
      doc.moveDown(1);
    }
    const lineGap = SIGNOFF_LINE_GAP; // room to write by hand
    for (const fields of lines) {
      ensureSpace(lineGap);
      const y = doc.y + 10;
      const slot = width() / fields.length;
      fields.forEach((field, i) => {
        const x = left + i * slot;
        const label = `${latin(field.label)}:`;
        bold(SIZE.body, COLOR.text);
        const labelWidth = doc.widthOfString(label) + 6;
        doc.text(label, x, y, { lineBreak: false });
        const lineStart = x + labelWidth;
        const lineEnd = x + slot - (i < fields.length - 1 ? 16 : 0);
        doc.moveTo(lineStart, y + 11).lineTo(lineEnd, y + 11).lineWidth(0.6).strokeColor(COLOR.muted).stroke();
        if (field.value) body(SIZE.body, COLOR.text).text(field.value, lineStart + 4, y - 1, { width: lineEnd - lineStart - 8, lineBreak: false, ellipsis: true });
      });
      doc.x = left;
      doc.y = y + lineGap - 10;
    }
    doc.moveDown(0.8);
  }

  function card(title: string, blocks: RecordBlock[]) {
    bold(SIZE.body);
    ensureSpace(doc.heightOfString(latin(title), { width: width() - 12 }) + 40);
    const y = doc.y;
    const titleHeight = doc.heightOfString(latin(title), { width: width() - 12 }) + 8;
    doc.rect(left, y, width(), titleHeight).fillColor(COLOR.cardFill).fill();
    bold(SIZE.body).text(latin(title), left + 6, y + 4, { width: width() - 12 });
    doc.x = left;
    doc.y = y + titleHeight + 4;
    blocks.forEach(render);
    doc.moveTo(left, doc.y).lineTo(left + width(), doc.y).lineWidth(0.5).strokeColor(COLOR.border).stroke();
    doc.moveDown(0.6);
  }

  function render(block: RecordBlock) {
    switch (block.kind) {
      case "fields":
        fields(block.rows);
        doc.moveDown(0.4);
        break;
      case "table":
        table(block.head, block.rows, block.empty);
        break;
      case "text":
        paragraph(block.label, block.text);
        break;
      case "list":
        list(block.items);
        break;
      case "note":
        note(block.text);
        break;
      case "card":
        card(block.title, block.blocks);
        break;
      case "statement":
        statement(block.head, block.rows);
        break;
      case "signoff":
        signoff(block.statement, block.lines);
        break;
    }
  }

  for (const section of record.sections) {
    // Keep a section heading with at least a couple of lines of its content — and a hand-signed
    // sign-off section entirely on one page.
    const signoffBlock = section.blocks.find((b) => b.kind === "signoff");
    ensureSpace(signoffBlock && signoffBlock.kind === "signoff" ? 50 + signoffBlock.lines.length * SIGNOFF_LINE_GAP + (signoffBlock.statement ? 45 : 0) : 60);
    const y = doc.y;
    bold(SIZE.section, COLOR.primary).text(latin(section.title), left, y, { width: width() });
    const ruleY = doc.y + 2;
    doc.moveTo(left, ruleY).lineTo(left + width(), ruleY).lineWidth(0.5).strokeColor(COLOR.border).stroke();
    doc.y = ruleY + 6;
    section.blocks.forEach(render);
    doc.moveDown(0.6);
  }

  // ---- Footer on every page ----
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - PAGE.margin - 12;
    doc.moveTo(left, y - 6).lineTo(doc.page.width - PAGE.margin, y - 6).lineWidth(0.5).strokeColor(COLOR.border).stroke();
    // Writing below the bottom margin would otherwise start a new page.
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    body(7.5, COLOR.muted).text(`CAIAS Consultancy Portal · ${record.heading}${record.consultancyCode ? ` · ${record.consultancyCode}` : ""}`, left, y, {
      width: width() - 80,
      lineBreak: false,
    });
    body(7.5, COLOR.muted).text(`Page ${i - range.start + 1} of ${range.count}`, doc.page.width - PAGE.margin - 80, y, { width: 80, align: "right", lineBreak: false });
    doc.page.margins.bottom = savedBottom;
  }

  doc.end();
  return done;
}
