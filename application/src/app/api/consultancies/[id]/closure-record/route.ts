import type { NextRequest } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { progressUpdates, milestones, closures, closureExceptions, clientAcceptances } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { buildConsultancySnapshot } from "@/lib/consultancy/snapshot";
import { getFinancialSummary } from "@/lib/consultancy/financials";

/**
 * The Closure Record — assembled on read from registration, monitoring, and
 * closure data across the tables those phases already own, per the plan's
 * explicit "not a duplicated denormalized table" instruction.
 */
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

  const [registration, progress, milestoneRows, closureRows, financial] = await Promise.all([
    buildConsultancySnapshot(db, id),
    db.select().from(progressUpdates).where(eq(progressUpdates.consultancyId, id)).orderBy(asc(progressUpdates.reportDate)),
    db.select().from(milestones).where(eq(milestones.consultancyId, id)).orderBy(asc(milestones.plannedDate)),
    db.select().from(closures).where(eq(closures.consultancyId, id)).orderBy(desc(closures.createdAt)),
    getFinancialSummary(consultancy),
  ]);

  const finalClosure = closureRows.find((c) => c.status === "completed") ?? closureRows[0] ?? null;
  const [exceptions, acceptances] = await Promise.all([
    finalClosure
      ? db.select().from(closureExceptions).where(eq(closureExceptions.closureId, finalClosure.id))
      : Promise.resolve([]),
    db.select().from(clientAcceptances).where(eq(clientAcceptances.consultancyId, id)),
  ]);

  return Response.json({
    data: {
      registration,
      monitoring: { progressUpdates: progress, milestones: milestoneRows },
      closure: { attempts: closureRows, current: finalClosure, exceptions, clientAcceptances: acceptances },
      financial,
    },
  });
}
