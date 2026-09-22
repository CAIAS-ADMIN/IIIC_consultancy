import PDFDocument from "pdfkit";

export function generateCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const escape = (value: unknown) => {
    const s = value == null ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => escape(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => escape(row[c.key])).join(","));
  return [header, ...lines].join("\r\n");
}

/** A one-page PDF summary — title, filters, totals, and a compact listing of the matching records. */
export function generatePdfSummary(input: {
  title: string;
  generatedAt: Date;
  filterSummary: string;
  totalCount: number;
  rows: { consultancyCode: string | null; title: string; status: string }[];
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text(input.title, { align: "center" });
    doc.moveDown();
    doc.fontSize(10).text(`Generated: ${input.generatedAt.toISOString()}`);
    doc.text(`Filters: ${input.filterSummary || "none"}`);
    doc.text(`Total matching records: ${input.totalCount}`);
    doc.moveDown();

    doc.fontSize(9);
    for (const row of input.rows) {
      doc.text(`${row.consultancyCode ?? "(unassigned)"}  |  ${row.title}  |  ${row.status}`);
    }

    doc.end();
  });
}
