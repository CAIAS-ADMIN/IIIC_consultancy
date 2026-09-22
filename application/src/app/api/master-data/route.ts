import type { NextRequest } from "next/server";
import { requireRole, requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { masterData } from "@/db/schema";
import { listMasterData } from "@/db/queries/master-data";
import { createMasterDataSchema } from "@/lib/validation/master-data";
import { recordAuditEvent } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const category = request.nextUrl.searchParams.get("category") ?? undefined;
  const rows = await listMasterData(category);
  return Response.json({ data: rows });
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireRole("system_admin");
  } catch (error) {
    return authErrorResponse(error);
  }

  const body = await request.json();
  const parsed = createMasterDataSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [created] = await db
    .insert(masterData)
    .values({
      ...parsed.data,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning();

  await recordAuditEvent({
    entityType: "master_data",
    entityId: created.id,
    action: "created",
    actorId: user.id,
    oldValue: null,
    newValue: created,
  });

  return Response.json({ data: created }, { status: 201 });
}
