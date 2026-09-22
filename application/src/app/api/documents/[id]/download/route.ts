import type { NextRequest } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { getDocumentById } from "@/db/queries/documents";
import { getConsultancyById } from "@/db/queries/consultancies";
import { canViewDocument } from "@/lib/documents/permissions";
import { documentsBucket, s3Client } from "@/lib/storage/rustfs";

const DOWNLOAD_URL_EXPIRY_SECONDS = 300;

/** GET /api/documents/:id/download — a presigned GET URL, gated on the document's confidentiality level. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const document = await getDocumentById(id);
  if (!document || document.status !== "available") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const consultancy = await getConsultancyById(document.consultancyId);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await canViewDocument(user, consultancy, document.confidentialityLevel);
  if (!allowed) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const downloadUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: documentsBucket,
      Key: document.objectKey,
      ResponseContentDisposition: `attachment; filename="${document.originalFileName.replace(/"/g, "")}"`,
    }),
    { expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS }
  );

  return Response.json({ data: { downloadUrl, expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS } });
}
