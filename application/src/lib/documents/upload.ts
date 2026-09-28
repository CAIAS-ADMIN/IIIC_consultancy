import { ALLOWED_DOCUMENT_CONTENT_TYPES, MAX_DOCUMENT_UPLOAD_BYTES } from "@/lib/validation/documents";
import type { ConfidentialityLevel } from "@/db/schema/enums";
import { apiErrorMessage } from "@/lib/api-error";

export const ALLOWED_EXTENSIONS_LABEL = "PDF, Word, Excel, JPEG, or PNG";
export const MAX_SIZE_LABEL = `${Math.floor(MAX_DOCUMENT_UPLOAD_BYTES / (1024 * 1024))}MB`;

export const CONFIDENTIALITY_LABELS: Record<ConfidentialityLevel, string> = {
  public: "Public",
  internal: "Internal",
  confidential: "Confidential",
  restricted: "Restricted",
};

/** Client-side pre-check of type and size; returns a user-facing message, or null when the file is acceptable. */
export function documentFileProblem(file: File): string | null {
  if (!(ALLOWED_DOCUMENT_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    return `"${file.name}" isn't an allowed file type. Allowed: ${ALLOWED_EXTENSIONS_LABEL}.`;
  }
  if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    return `"${file.name}" is larger than the ${MAX_SIZE_LABEL} limit.`;
  }
  return null;
}

/** The API's own reason when it gave one; otherwise what kind of failure it was, so it can be reported. */
async function failureMessage(res: Response, action: string): Promise<string> {
  const body = await res.json().catch(() => null);
  if (res.status >= 500) return `${action} — the server hit an error (${res.status}). Please try again; if it keeps happening, contact the IIIC office.`;
  if (res.status === 401) return "Your session has expired. Sign in again, then retry the upload.";
  if (res.status === 403) return "You don't have permission to upload documents to this consultancy.";
  return apiErrorMessage(body, `${action} (${res.status}).`);
}

/**
 * Uploads one file for a consultancy: presign -> PUT to storage -> confirm.
 * Throws an Error with a user-facing message on failure. Returns the
 * confirmed document row (its `status` may be "quarantined" after the scan).
 */
export async function uploadConsultancyDocument(input: {
  consultancyId: string;
  category: string;
  file: File;
  confidentialityLevel: ConfidentialityLevel;
}): Promise<{ id: string; status: string }> {
  const { consultancyId, category, file, confidentialityLevel } = input;
  try {
    const presignRes = await fetch("/api/documents/presign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        consultancyId,
        documentCategory: category,
        originalFileName: file.name,
        contentType: file.type,
        fileSizeBytes: file.size,
      }),
    });
    if (!presignRes.ok) {
      throw new Error(await failureMessage(presignRes, "Could not start the upload"));
    }
    const { data: presign } = await presignRes.json();

    const putRes = await fetch(presign.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
    if (!putRes.ok) {
      throw new Error("The file upload failed partway through. Please try again.");
    }

    const confirmRes = await fetch("/api/documents/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ consultancyId, objectKey: presign.objectKey, documentCategory: category, originalFileName: file.name, confidentialityLevel }),
    });
    if (!confirmRes.ok) {
      throw new Error(await failureMessage(confirmRes, "Could not confirm the upload"));
    }
    return (await confirmRes.json()).data;
  } catch (err) {
    // A TypeError from fetch means no response at all (network down, storage server unreachable, or blocked by CORS).
    if (err instanceof TypeError) {
      throw new Error("Could not reach the file storage server. Check your connection and try again; if it keeps failing, contact the IIIC office.");
    }
    throw err;
  }
}

/** Opens a short-lived link for a document in a new tab — `inline` views it in the browser, otherwise it downloads. Returns false when no link could be generated. */
export async function openDocumentDownload(documentId: string, options: { inline?: boolean } = {}): Promise<boolean> {
  const res = await fetch(`/api/documents/${documentId}/download${options.inline ? "?inline=1" : ""}`);
  if (!res.ok) return false;
  const { data } = await res.json();
  window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
  return true;
}
