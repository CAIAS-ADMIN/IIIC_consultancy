import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { resolveDepartmentScope } from "@/lib/consultancy/scope";
import { parseSearchFilters, searchConsultancies, validateSearchFilters } from "@/lib/consultancy/search";

/**
 * Search/filter across the master consultancy record (Phase 12 task 1) — no
 * separate register table. Supports Consultancy ID (partial), department,
 * faculty, client name (partial), status, academic year, a created-date
 * range, IP involvement, resource usage, derived payment status, and
 * pagination. A `faculty`-only caller is transparently scoped to their own
 * department rather than rejected.
 */
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const scope = resolveDepartmentScope(user);
  if (scope === null) {
    return Response.json({ data: [], total: 0, page: 1, pageSize: 20 });
  }

  const filters = parseSearchFilters(request.nextUrl.searchParams);
  const validationError = validateSearchFilters(filters);
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? "20") || 20;

  const result = await searchConsultancies(filters, scope, { page, pageSize });
  return Response.json({ data: result.rows, total: result.total, page: result.page, pageSize: result.pageSize });
}
