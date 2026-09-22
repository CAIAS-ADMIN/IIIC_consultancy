import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

/**
 * Read-only department list for the frontend shell's department switcher
 * (and any other picker that needs active departments). Any authenticated
 * role may read this — unlike master-data, there is no write endpoint here.
 */
export async function GET() {
  try {
    await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const rows = await db.query.departments.findMany({
    where: eq(departments.isActive, true),
    orderBy: [asc(departments.name)],
    columns: { id: true, name: true, code: true },
  });

  return Response.json({ data: rows });
}
