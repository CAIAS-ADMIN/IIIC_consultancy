import type { NextRequest } from "next/server";
import { eq, asc } from "drizzle-orm";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { consultancyVersions } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";

/** GET /api/consultancies/:id/versions — pre-clarification snapshots, oldest first. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const consultancy = await getConsultancyById(id);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const versions = await db
    .select()
    .from(consultancyVersions)
    .where(eq(consultancyVersions.consultancyId, id))
    .orderBy(asc(consultancyVersions.versionNumber));

  return Response.json({ data: versions });
}
