import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { resolveDepartmentScope } from "@/lib/consultancy/scope";
import { getFinancialsReport } from "@/lib/reports/aggregate";

/** Financial totals grouped by department and academic year — department-scoped for faculty-only callers. */
export async function GET() {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const data = await getFinancialsReport(resolveDepartmentScope(user));
  return Response.json({ data });
}
