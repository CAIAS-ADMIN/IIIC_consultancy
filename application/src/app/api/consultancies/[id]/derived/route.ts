import type { NextRequest } from "next/server";
import { canViewConsultancy } from "@/lib/consultancy/access";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { getConsultancyById } from "@/db/queries/consultancies";
import { getConsultancyDerivedFields } from "@/db/queries/consultancy-derived";

/** GET — days elapsed/remaining, overdue completion, overdue milestones. Computed on read, never stored. */
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

  const derived = await getConsultancyDerivedFields(consultancy);
  return Response.json({ data: derived });
}
