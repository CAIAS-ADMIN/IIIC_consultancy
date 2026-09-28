import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { getRegisterEntries, REGISTER_CSV_COLUMNS } from "@/db/queries/register";
import { generateCsv } from "@/lib/reports/export";
import { NO_DEPARTMENT, resolveDepartmentScope } from "@/lib/consultancy/scope";

/**
 * The Consultancy Register — auto-populated from closed consultancy
 * records, not a manually maintained table. `?format=csv` downloads the full
 * register with every spec §39 field. A static "register" route wins over
 * the sibling `[id]` dynamic route for this literal path.
 */
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const scope = resolveDepartmentScope(user);
  const { entries, total } = await getRegisterEntries(undefined, scope === null ? NO_DEPARTMENT : scope);

  if (request.nextUrl.searchParams.get("format") === "csv") {
    const csv = generateCsv(
      entries.map((e) => ({ ...e, ipInvolved: e.ipInvolved ? "Yes" : "No", caiasResourcesUsed: e.caiasResourcesUsed ? "Yes" : "No" })),
      REGISTER_CSV_COLUMNS.map(([key, label]) => ({ key, label }))
    );
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="consultancy-register-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return Response.json({ data: entries, count: total });
}
