import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { resolveDepartmentScope } from "@/lib/consultancy/scope";
import { getSummaryReport } from "@/lib/reports/aggregate";

/** Aggregate counts by status/department/academic year/client type/category — department-scoped for faculty-only callers. */
export async function GET() {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const data = await getSummaryReport(resolveDepartmentScope(user));
  return Response.json({ data });
}
