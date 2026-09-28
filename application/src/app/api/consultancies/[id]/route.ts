import type { NextRequest } from "next/server";
import { canEditDraft, canViewConsultancy } from "@/lib/consultancy/access";
import { resolveRequestedFacultyInCharge } from "@/lib/consultancy/faculty-in-charge";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import {
  consultancies,
  clients,
  agreements,
  consultancyTeamMembers,
  deliverables,
  consultancyDepartments,
  milestones,
  paymentSchedules,
} from "@/db/schema";
import { getConsultancyById, getClientByConsultancyId, getAgreementByConsultancyId } from "@/db/queries/consultancies";
import {
  pickAgreementFields,
  pickClientFields,
  pickDeliverableFields,
  pickDraftConsultancyFields,
  pickPaymentScheduleFields,
  pickPlannedMilestoneFields,
  pickTeamMemberFields,
} from "@/lib/consultancy/draft-fields";

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

  const [client, agreement, teamMembers, deliverableRows, departmentsInvolvedRows, milestoneRows, scheduleRows] = await Promise.all([
    getClientByConsultancyId(id),
    getAgreementByConsultancyId(id),
    db.query.consultancyTeamMembers.findMany({ where: eq(consultancyTeamMembers.consultancyId, id) }),
    db.query.deliverables.findMany({ where: eq(deliverables.consultancyId, id) }),
    db.query.consultancyDepartments.findMany({ where: eq(consultancyDepartments.consultancyId, id) }),
    db.query.milestones.findMany({ where: eq(milestones.consultancyId, id) }),
    db.query.paymentSchedules.findMany({ where: eq(paymentSchedules.consultancyId, id) }),
  ]);

  return Response.json({
    data: {
      consultancy,
      client,
      agreement,
      teamMembers,
      deliverables: deliverableRows,
      milestones: milestoneRows,
      paymentSchedule: scheduleRows,
      departmentsInvolved: departmentsInvolvedRows.map((r) => r.departmentId),
    },
  });
}

/**
 * Patches a consultancy. Two distinct editable windows:
 *  - `draft`: full edit (consultancy/client/agreement) by the creator or an
 *    elevated role — pre-submission, nothing is locked yet.
 *  - `clarification_required` (Phase 6): only the originating faculty/creator
 *    may edit, and only the top-level consultancy columns named in
 *    `flaggedFields` (set by `verifyStage`'s "return" decision) — no
 *    client/agreement edits here, and any other field name is rejected.
 * Every other status is locked from ordinary edits.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const existing = await getConsultancyById(id);
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.status === "clarification_required") {
    if (existing.createdBy !== user.id && existing.facultyInChargeId !== user.id && !user.roles.includes("system_admin")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) ?? {};
    const allowed = new Set(existing.flaggedFields ?? []);
    const disallowed = Object.keys(body).filter((key) => !allowed.has(key));
    if (disallowed.length > 0) {
      return Response.json(
        { error: `These fields are not flagged for clarification and cannot be edited: ${disallowed.join(", ")}` },
        { status: 400 }
      );
    }

    // Keep each field's shape: a list stays a list, a Yes/No stays boolean.
    const current = existing as unknown as Record<string, unknown>;
    const mistyped = Object.keys(body).filter((key) => {
      const was = current[key];
      const now = body[key];
      if (typeof was === "boolean") return typeof now !== "boolean";
      if (Array.isArray(was)) return !Array.isArray(now);
      if (was !== null && typeof was === "object" && !(was instanceof Date)) return now === null || typeof now !== "object";
      return now !== null && typeof now === "object";
    });
    if (mistyped.length > 0) {
      return Response.json({ error: `Invalid value for: ${mistyped.join(", ")}` }, { status: 400 });
    }

    if (Object.keys(body).length > 0) {
      await db
        .update(consultancies)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(consultancies.id, id));
    }

    const updated = await getConsultancyById(id);
    return Response.json({ data: updated });
  }

  if (existing.isLocked || existing.status !== "draft") {
    return Response.json(
      { error: "This record is locked and can only be edited via the clarification workflow" },
      { status: 409 }
    );
  }

  if (!canEditDraft(user, existing)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) ?? {};
  const {
    client,
    agreement,
    teamMembers,
    deliverables: deliverableInputs,
    milestones: milestoneInputs,
    paymentSchedule: scheduleInputs,
    departmentsInvolved,
  } = body;
  const consultancyFields = pickDraftConsultancyFields(body);
  const facultyInCharge = await resolveRequestedFacultyInCharge(user, body.facultyInChargeId);
  if (facultyInCharge.error) {
    return Response.json({ error: facultyInCharge.error }, { status: 400 });
  }
  if (facultyInCharge.userId) {
    consultancyFields.facultyInChargeId = facultyInCharge.userId;
  }

  if (Object.keys(consultancyFields).length > 0) {
    await db
      .update(consultancies)
      .set({ ...consultancyFields, updatedAt: new Date() })
      .where(eq(consultancies.id, id));
  }

  if (client && typeof client === "object") {
    const clientFields = pickClientFields(client);
    const existingClient = await getClientByConsultancyId(id);
    if (existingClient) {
      await db.update(clients).set({ ...clientFields, updatedAt: new Date() }).where(eq(clients.id, existingClient.id));
    } else if (typeof clientFields.organizationName === "string" && typeof clientFields.organizationTypeCode === "string") {
      await db.insert(clients).values({ ...(clientFields as typeof clients.$inferInsert), consultancyId: id });
    }
  }

  if (agreement && typeof agreement === "object") {
    const agreementFields = pickAgreementFields(agreement);
    const existingAgreement = await getAgreementByConsultancyId(id);
    if (existingAgreement) {
      await db.update(agreements).set({ ...agreementFields, updatedAt: new Date() }).where(eq(agreements.id, existingAgreement.id));
    } else if (agreementFields.agreementTypeCode && agreementFields.paymentTermsCode && agreementFields.agreementValue) {
      await db.insert(agreements).values({ ...(agreementFields as typeof agreements.$inferInsert), consultancyId: id });
    }
  }

  // Child-table sections have no home on the `consultancies` row itself —
  // persisted here the same delete-then-reinsert way `submit` does, so a
  // "Save Draft" doesn't silently lose them. Deliberately lenient (no zod
  // schema) — a draft may be incomplete; `submitConsultancySchema` enforces
  // the real shape at submit. Rows missing a NOT NULL column are skipped.
  if (Array.isArray(teamMembers)) {
    const rows = teamMembers.map(pickTeamMemberFields).filter((m) => m.name && m.role);
    await db.delete(consultancyTeamMembers).where(eq(consultancyTeamMembers.consultancyId, id));
    if (rows.length > 0) {
      await db
        .insert(consultancyTeamMembers)
        .values(rows.map((m) => ({ ...(m as typeof consultancyTeamMembers.$inferInsert), consultancyId: id })));
    }
  }

  if (Array.isArray(deliverableInputs)) {
    const rows = deliverableInputs.map(pickDeliverableFields).filter((d) => d.name || d.description);
    await db.delete(deliverables).where(eq(deliverables.consultancyId, id));
    if (rows.length > 0) {
      await db.insert(deliverables).values(rows.map((d) => ({ ...(d as typeof deliverables.$inferInsert), consultancyId: id })));
    }
  }

  if (Array.isArray(milestoneInputs)) {
    const rows = milestoneInputs.map(pickPlannedMilestoneFields).filter((m) => m.title && m.plannedDate);
    await db.delete(milestones).where(eq(milestones.consultancyId, id));
    if (rows.length > 0) {
      await db.insert(milestones).values(rows.map((m) => ({ ...(m as typeof milestones.$inferInsert), consultancyId: id })));
    }
  }

  if (Array.isArray(scheduleInputs)) {
    const rows = scheduleInputs.map(pickPaymentScheduleFields).filter((p) => p.stageLabel && p.plannedAmount);
    await db.delete(paymentSchedules).where(eq(paymentSchedules.consultancyId, id));
    if (rows.length > 0) {
      await db
        .insert(paymentSchedules)
        .values(rows.map((p) => ({ ...(p as typeof paymentSchedules.$inferInsert), plannedDate: (p.plannedDate as string) || null, consultancyId: id })));
    }
  }

  if (Array.isArray(departmentsInvolved)) {
    const ids = departmentsInvolved.filter((d: unknown): d is string => typeof d === "string");
    await db.delete(consultancyDepartments).where(eq(consultancyDepartments.consultancyId, id));
    if (ids.length > 0) {
      await db.insert(consultancyDepartments).values(ids.map((departmentId) => ({ consultancyId: id, departmentId })));
    }
  }

  const updated = await getConsultancyById(id);
  return Response.json({ data: updated });
}
