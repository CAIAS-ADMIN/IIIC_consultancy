import type { NextRequest } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { presignDocumentSchema } from "@/lib/validation/documents";
import { getConsultancyById } from "@/db/queries/consultancies";
import { buildObjectKey } from "@/lib/documents/objectKey";
import { documentsBucket, s3Client, ensureBucketExists } from "@/lib/storage/rustfs";

const UPLOAD_URL_EXPIRY_SECONDS = 300;

const EDITOR_ROLES = ["hod", "iiic_admin", "system_admin"] as const;

/** POST /api/documents/presign — a presigned PUT URL for a given consultancy + document category. */
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const body = await request.json();
  const parsed = presignDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { consultancyId, documentCategory, originalFileName, contentType } = parsed.data;

  const consultancy = await getConsultancyById(consultancyId);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (consultancy.createdBy !== user.id && !user.roles.some((r) => EDITOR_ROLES.includes(r as (typeof EDITOR_ROLES)[number]))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureBucketExists();

  const objectKey = buildObjectKey(consultancyId, documentCategory, originalFileName);
  const uploadUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: documentsBucket,
      Key: objectKey,
      ContentType: contentType,
    }),
    { expiresIn: UPLOAD_URL_EXPIRY_SECONDS }
  );

  return Response.json({
    data: { uploadUrl, objectKey, expiresIn: UPLOAD_URL_EXPIRY_SECONDS },
  });
}
