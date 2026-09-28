"use client";

import * as React from "react";
import { CheckCircle2, Download, Eye, FileText, Loader2, Lock, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { humanizeStatus, toneClassesFor } from "@/lib/status";
import { ALLOWED_DOCUMENT_CONTENT_TYPES } from "@/lib/validation/documents";
import {
  ALLOWED_EXTENSIONS_LABEL,
  MAX_SIZE_LABEL,
  documentFileProblem,
  openDocumentDownload,
  uploadConsultancyDocument,
} from "@/lib/documents/upload";
import type { ConfidentialityLevel, DocumentStatus } from "@/db/schema/enums";

export type DocumentRow = {
  id: string;
  documentCategory: string;
  version: number;
  originalFileName: string;
  status: DocumentStatus;
  confidentialityLevel: ConfidentialityLevel;
  uploadedAt: string;
  uploadedByName: string | null;
  viewerCanDownload: boolean;
};

/**
 * Full per-category document manager: fetches every version already on
 * record, uploads new ones (presign -> PUT -> confirm) with a confidentiality
 * selector, and renders a version history where the caller's own download
 * permission (computed server-side, same rule as the real download route) is
 * shown as a locked affordance rather than only surfacing as a 403 on click.
 * Used both inside the registration wizard (Phase 3) and the standalone
 * Documents hub (Phase 4) — one component, not two copies.
 */
export function DocumentCategoryPanel({
  consultancyId,
  category,
  label,
  required,
  onUploadedChange,
}: {
  consultancyId: string | null;
  category: string;
  label: string;
  required?: boolean;
  onUploadedChange?: (hasAvailableVersion: boolean) => void;
}) {
  const [documents, setDocuments] = React.useState<DocumentRow[] | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const refresh = React.useCallback(async () => {
    if (!consultancyId) {
      setDocuments([]);
      return;
    }
    const res = await fetch(`/api/consultancies/${consultancyId}/documents?category=${encodeURIComponent(category)}`);
    if (!res.ok) {
      setDocuments([]);
      return;
    }
    const { data } = await res.json();
    setDocuments(data);
    onUploadedChange?.(data.some((d: DocumentRow) => d.status === "available"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultancyId, category]);

  React.useEffect(() => {
    // Legitimate fetch-on-mount/fetch-on-change (re-fetches whenever
    // consultancyId/category change) — the setState calls only happen after
    // the awaited fetch resolves, never synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this static check can't see the await boundary inside `refresh`
    void refresh();
  }, [refresh]);

  async function handleFile(file: File) {
    setError(null);

    if (!consultancyId) {
      setError('Save this consultancy as a draft first (use "Save Draft" below), then upload here.');
      return;
    }
    const problem = documentFileProblem(file);
    if (problem) {
      setError(problem);
      return;
    }

    setUploading(true);
    try {
      const doc = await uploadConsultancyDocument({ consultancyId, category, file, confidentialityLevel: "internal" });
      if (doc.status === "quarantined") {
        setError("This file was flagged by the malware scan and was not accepted. Try a different file.");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(documentId: string) {
    if (!(await openDocumentDownload(documentId))) {
      setError("Could not generate a download link for this file.");
    }
  }

  const current = documents?.find((d) => d.status === "available");
  const history = documents?.filter((d) => d.id !== current?.id) ?? [];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-status-danger-fg"> *</span>}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={(ALLOWED_DOCUMENT_CONTENT_TYPES as readonly string[]).join(",")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 text-center transition-colors",
          dragActive ? "border-primary bg-primary-soft" : "border-border hover:border-input-border",
          "disabled:cursor-not-allowed disabled:opacity-60"
        )}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <UploadCloud className="h-6 w-6 text-muted-foreground" aria-hidden />
        )}
        <span className="text-sm text-muted-foreground">
          {uploading
            ? "Uploading…"
            : current
              ? "Tap to choose a replacement, or drag and drop"
              : "Tap to choose a file, or drag and drop"}
        </span>
        <span className="text-xs text-muted-foreground">
          {ALLOWED_EXTENSIONS_LABEL} — up to {MAX_SIZE_LABEL}
        </span>
      </button>

      {error && (
        <p role="alert" className="text-sm text-status-danger-fg">
          {error}
        </p>
      )}

      {documents === null ? (
        <Skeleton className="h-12 w-full" />
      ) : (
        current && (
          <div className="flex flex-col gap-2">
            <DocumentRowView doc={current} isCurrent onDownload={handleDownload} />
            {history.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t border-border pt-2">
                <p className="text-xs font-medium text-muted-foreground">Previous versions</p>
                {history.map((doc) => (
                  <DocumentRowView key={doc.id} doc={doc} onDownload={handleDownload} />
                ))}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

export function DocumentRowView({
  doc,
  isCurrent,
  onDownload,
  onRemove,
}: {
  doc: DocumentRow;
  isCurrent?: boolean;
  onDownload: (id: string) => void;
  /** When given, a Remove button (with an inline confirm) is shown. */
  onRemove?: (id: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);

  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-background px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate text-sm text-foreground">{doc.originalFileName}</span>
        <span className="shrink-0 text-xs text-muted-foreground">v{doc.version}</span>
        {isCurrent && (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-status-success-fg">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Current
          </span>
        )}
        {doc.status !== "available" && (
          <span className={cn("shrink-0 rounded-pill px-2 py-0.5 text-xs font-medium", toneClassesFor(doc.status))}>
            {humanizeStatus(doc.status)}
          </span>
        )}
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {doc.uploadedByName ?? "Unknown"} · {new Date(doc.uploadedAt).toLocaleDateString()}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {confirming ? (
          <>
            <span className="text-xs text-muted-foreground">Remove?</span>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={removing}
              onClick={async () => {
                setRemoving(true);
                try {
                  await onRemove?.(doc.id);
                } finally {
                  setRemoving(false);
                  setConfirming(false);
                }
              }}
            >
              {removing ? "Removing…" : "Remove"}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={removing} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            {doc.viewerCanDownload ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  aria-label={`View ${doc.originalFileName}`}
                  onClick={async () => {
                    if (!(await openDocumentDownload(doc.id, { inline: true }))) onDownload(doc.id);
                  }}
                >
                  <Eye className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">View</span>
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label={`Download ${doc.originalFileName}`} onClick={() => onDownload(doc.id)}>
                  <Download className="h-4 w-4" aria-hidden />
                </Button>
              </>
            ) : (
              <span title="You don't have permission to download this file" className="flex h-10 w-10 items-center justify-center text-muted-foreground">
                <Lock className="h-4 w-4" aria-hidden />
              </span>
            )}
            {onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${doc.originalFileName}`}
                className="text-status-danger-fg"
                onClick={() => setConfirming(true)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
