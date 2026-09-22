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

export const MAX_DOCUMENT_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

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
