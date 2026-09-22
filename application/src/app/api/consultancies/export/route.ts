import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { resolveDepartmentScope } from "@/lib/consultancy/scope";
import { parseSearchFilters, searchAllForExport, validateSearchFilters } from "@/lib/consultancy/search";
import { generateCsv, generatePdfSummary } from "@/lib/reports/export";

const CSV_COLUMNS = [
  { key: "consultancyCode", label: "Consultancy ID" },
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "departmentId", label: "Department ID" },
  { key: "academicYearCode", label: "Academic Year" },
  { key: "clientOrganizationName", label: "Client" },
  { key: "totalValue", label: "Total Value" },
  { key: "startDate", label: "Start Date" },
  { key: "currentCompletionDate", label: "Completion Date" },
];

/**
 * Export — same filters/department scope as `/search` (Phase 12 task 3), so
 * the exported file always matches what the equivalent search would return.
 * `?format=csv` (structured data — Excel opens CSV natively) or `?format=pdf`
 * (summary). A `faculty`-only caller is scoped to their own department, same
 * as search — never allowed to export outside it.
 */
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  if (format !== "csv" && format !== "pdf") {
    return Response.json({ error: "format must be 'csv' or 'pdf'" }, { status: 400 });
  }

  const filters = parseSearchFilters(request.nextUrl.searchParams);
  const validationError = validateSearchFilters(filters);
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const scope = resolveDepartmentScope(user);
  const rows = scope === null ? [] : await searchAllForExport(filters, scope);

  if (format === "csv") {
    const csv = generateCsv(rows, CSV_COLUMNS);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="consultancies-export.csv"`,
      },
    });
  }

  const filterSummary = Object.entries(filters)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  const pdf = await generatePdfSummary({
    title: "CAIAS Consultancy Export Summary",
    generatedAt: new Date(),
    filterSummary,
    totalCount: rows.length,
    rows,
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="consultancies-export.pdf"`,
    },
  });
}
