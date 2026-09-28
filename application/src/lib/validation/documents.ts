import { z } from "zod";

export const confidentialityLevels = ["public", "internal", "confidential", "restricted"] as const;

// Server-side allow-list for uploaded documents (Phase 13 hardening — the
// presign endpoint used to accept any declared contentType/size from the
// client). Covers the realistic set of registration/closure attachments:
// agreements, reports, spreadsheets, and scanned images.
export const ALLOWED_DOCUMENT_CONTENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
] as const;

/**
 * Per-file upload limit — portal spec §15/§48.3: "Maximum file size: 10 MB
 * per file, configurable". Set NEXT_PUBLIC_MAX_UPLOAD_MB to change it; the
 * NEXT_PUBLIC_ prefix makes the same value reach the browser's pre-check,
 * so client and server always agree.
 */
const configuredUploadMb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB);
export const MAX_DOCUMENT_UPLOAD_MB = Number.isFinite(configuredUploadMb) && configuredUploadMb > 0 ? configuredUploadMb : 10;
export const MAX_DOCUMENT_UPLOAD_BYTES = Math.round(MAX_DOCUMENT_UPLOAD_MB * 1024 * 1024);

export const presignDocumentSchema = z.object({
  consultancyId: z.string().uuid(),
  documentCategory: z.string().min(1).max(100),
  originalFileName: z.string().min(1).max(512),
  contentType: z.enum(ALLOWED_DOCUMENT_CONTENT_TYPES),
  fileSizeBytes: z.number().int().positive().max(MAX_DOCUMENT_UPLOAD_BYTES),
});

export const confirmDocumentUploadSchema = z.object({
  consultancyId: z.string().uuid(),
  objectKey: z.string().min(1).max(1024),
  documentCategory: z.string().min(1).max(100),
  originalFileName: z.string().min(1).max(512),
  confidentialityLevel: z.enum(confidentialityLevels).default("internal"),
});
