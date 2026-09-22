import { desc, eq, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { consultancies, closures } from "@/db/schema";

/**
 * The Consultancy Register — auto-populated from closed consultancy
 * records, not a manually maintained table (per the plan's explicit
 * instruction). A static "register" route wins over the sibling `[id]`
 * dynamic route for this literal path.
 */
export async function GET() {
  try {
    await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const closedConsultancies = await db
    .select()
    .from(consultancies)
    .where(eq(consultancies.status, "completed_closed"))
    .orderBy(desc(consultancies.actualCompletionDate));

  const closureRows =
    closedConsultancies.length > 0
      ? await db
          .select()
          .from(closures)
          .where(inArray(closures.consultancyId, closedConsultancies.map((c) => c.id)))
      : [];
  const finalClosureByConsultancy = new Map<string, (typeof closureRows)[number]>();
  for (const closure of closureRows) {
    if (closure.status === "completed") {
      finalClosureByConsultancy.set(closure.consultancyId, closure);
    }
  }

  const data = closedConsultancies.map((c) => ({
    consultancyId: c.id,
    consultancyCode: c.consultancyCode,
    title: c.title,
    departmentId: c.departmentId,
    actualCompletionDate: c.actualCompletionDate,
    finalOutcomes: finalClosureByConsultancy.get(c.id)?.finalOutcomes ?? null,
    deliverableCompletionStatus: finalClosureByConsultancy.get(c.id)?.deliverableCompletionStatus ?? null,
  }));

  return Response.json({ data, count: data.length });
}
