import type { NextRequest } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { getDocumentById } from "@/db/queries/documents";
import { getConsultancyById } from "@/db/queries/consultancies";
import { canManageDocuments } from "@/lib/consultancy/access";
import { documentsBucket, s3Client } from "@/lib/storage/rustfs";
import { recordAuditEvent } from "@/lib/audit";

/**
 * DELETE /api/documents/:id — remove an uploaded file while its consultancy
 * is still a draft (a wrong file picked during registration). Once submitted,
 * documents are part of the record and can only be superseded by a newer
 * version, never removed. The removal itself is audited.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const document = await getDocumentById(id);
  if (!document) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const consultancy = await getConsultancyById(document.consultancyId);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!canManageDocuments(user, consultancy)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (consultancy.status !== "draft") {
    return Response.json(
      { error: "Documents can only be removed while the consultancy is a draft — upload a newer version instead" },
      { status: 409 }
    );
  }

  await db.transaction(async (tx) => {
    await tx.delete(documents).where(eq(documents.id, id));
    await recordAuditEvent(
      {
        consultancyId: consultancy.id,
        entityType: "document",
        entityId: id,
        action: "document_removed",
        actorId: user.id,
        oldValue: {
          documentCategory: document.documentCategory,
          originalFileName: document.originalFileName,
          version: document.version,
        },
      },
      tx
    );
  });

  // Best effort: the row is already gone, so a leftover object is unreachable either way.
  await s3Client.send(new DeleteObjectCommand({ Bucket: documentsBucket, Key: document.objectKey })).catch(() => undefined);

  return Response.json({ data: { id } });
}
