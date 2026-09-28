import type { NextRequest } from "next/server";
import { canViewConsultancy } from "@/lib/consultancy/access";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { getConsultancyById } from "@/db/queries/consultancies";
import { getFinancialSummary } from "@/lib/consultancy/financials";

/** Faculty-facing read-only view: total value, amount received, amount pending, payment status. No write path here at all. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let viewer;
  try {
    viewer = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const consultancy = await getConsultancyById(id);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await canViewConsultancy(viewer, consultancy))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const summary = await getFinancialSummary(consultancy);
  return Response.json({ data: summary });
}
