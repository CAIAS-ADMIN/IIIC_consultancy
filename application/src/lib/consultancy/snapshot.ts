import { eq } from "drizzle-orm";
import {
  consultancies,
  clients,
  agreements,
  consultancyTeamMembers,
  consultancyDepartments,
  deliverables,
} from "@/db/schema";
import type { Executor } from "@/db";

/** Full JSON snapshot of a consultancy + its child rows, for `consultancy_versions`. */
export async function buildConsultancySnapshot(executor: Executor, consultancyId: string) {
  const [consultancy, client, agreement, team, departmentsInvolved, deliverableRows] = await Promise.all([
    executor.query.consultancies.findFirst({ where: eq(consultancies.id, consultancyId) }),
    executor.query.clients.findFirst({ where: eq(clients.consultancyId, consultancyId) }),
    executor.query.agreements.findFirst({ where: eq(agreements.consultancyId, consultancyId) }),
    executor.query.consultancyTeamMembers.findMany({ where: eq(consultancyTeamMembers.consultancyId, consultancyId) }),
    executor.query.consultancyDepartments.findMany({ where: eq(consultancyDepartments.consultancyId, consultancyId) }),
    executor.query.deliverables.findMany({ where: eq(deliverables.consultancyId, consultancyId) }),
  ]);

  return { consultancy, client, agreement, team, departmentsInvolved, deliverables: deliverableRows };
}
