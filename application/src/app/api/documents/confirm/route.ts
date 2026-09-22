import type { NextRequest } from "next/server";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { confirmDocumentUploadSchema, MAX_DOCUMENT_UPLOAD_BYTES } from "@/lib/validation/documents";
import { getConsultancyById } from "@/db/queries/consultancies";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { nextDocumentVersion } from "@/lib/documents/version";
import { scanDocument } from "@/lib/storage/scan";
import { documentsBucket, s3Client } from "@/lib/storage/rustfs";
import { recordAuditEvent } from "@/lib/audit";

const EDITOR_ROLES = ["hod", "iiic_admin", "system_admin"] as const;

/**
 * confirmDocumentUpload — called after the client's PUT to the presigned URL
 * succeeds. Writes the `documents` row (never overwrites a prior version),
 * runs the (stub) malware scan, and flips status to `available`.
 */
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const body = await request.json();
  const parsed = confirmDocumentUploadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { consultancyId, objectKey, documentCategory, originalFileName, confidentialityLevel } = parsed.data;

  const consultancy = await getConsultancyById(consultancyId);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (consultancy.createdBy !== user.id && !user.roles.some((r) => EDITOR_ROLES.includes(r as (typeof EDITOR_ROLES)[number]))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!objectKey.startsWith(`consultancies/${consultancyId}/`)) {
    return Response.json({ error: "objectKey does not belong to this consultancy" }, { status: 400 });
  }

  let uploadedContentLength: number | undefined;
  try {
    const head = await s3Client.send(new HeadObjectCommand({ Bucket: documentsBucket, Key: objectKey }));
    uploadedContentLength = head.ContentLength;
  } catch {
    return Response.json({ error: "Upload not found at objectKey — PUT to the presigned URL first" }, { status: 409 });
  }
  // The declared fileSizeBytes at presign time is only a client claim — this is
  // the real, server-side enforcement point, since a presigned PUT URL doesn't
  // itself cap how many bytes the client sends.
  if (uploadedContentLength !== undefined && uploadedContentLength > MAX_DOCUMENT_UPLOAD_BYTES) {
    return Response.json(
      { error: `Uploaded file exceeds the maximum allowed size of ${MAX_DOCUMENT_UPLOAD_BYTES} bytes` },
      { status: 413 }
    );
  }

  const created = await db.transaction(async (tx) => {
    const version = await nextDocumentVersion(tx, consultancyId, documentCategory);

    const [row] = await tx
      .insert(documents)
      .values({
        consultancyId,
        documentCategory,
        originalFileName,
        objectKey,
        version,
        confidentialityLevel,
        status: "uploading",
        uploadedBy: user.id,
      })
      .returning();

    await recordAuditEvent(
      {
        consultancyId,
        entityType: "document",
        entityId: row.id,
        action: "uploaded",
        actorId: user.id,
        newValue: { documentCategory, version, objectKey },
      },
      tx
    );

    return row;
  });

  const scanResult = await scanDocument(objectKey);

  const [finalRow] = await db
    .update(documents)
    .set({ status: scanResult.clean ? "available" : "quarantined" })
    .where(eq(documents.id, created.id))
    .returning();

  return Response.json({ data: finalRow }, { status: 201 });
}
