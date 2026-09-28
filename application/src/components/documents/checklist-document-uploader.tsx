"use client";

import * as React from "react";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ALLOWED_DOCUMENT_CONTENT_TYPES } from "@/lib/validation/documents";
import {
  ALLOWED_EXTENSIONS_LABEL,
  MAX_SIZE_LABEL,
  documentFileProblem,
  openDocumentDownload,
  uploadConsultancyDocument,
} from "@/lib/documents/upload";
import type { ConfidentialityLevel } from "@/db/schema/enums";
import { DocumentRowView, type DocumentRow } from "./document-category-panel";

export type ChecklistItem = { category: string; label: string; requirement: string; required?: boolean };

const OTHER_OPTION = "__other__";
/** Every upload is Internal: the record's team and the office roles can open it. */
const DEFAULT_CONFIDENTIALITY: ConfidentialityLevel = "internal";

/**
 * One uploader for a whole document checklist: pick the document type from a
 * dropdown (or "Other" and type a name), choose one file, upload. Below it,
 * the documents uploaded so far are listed with View / Download / Remove; the
 * dropdown marks each type already uploaded. Uploading a type that already
 * has a file adds a new version (the old one is kept in history).
 */
export function ChecklistDocumentUploader({
  consultancyId,
  ensureConsultancyId,
  items,
  onCategoryUploadedChange,
}: {
  consultancyId: string | null;
  /** Saves the record when it doesn't exist yet (a new wizard draft), so an upload never has to ask the user to save first. */
  ensureConsultancyId?: () => Promise<string | null>;
  items: ChecklistItem[];
  /** Called after every refresh with the set of categories that have an available document. */
  onCategoryUploadedChange?: (uploaded: Set<string>) => void;
}) {
  const [documents, setDocuments] = React.useState<DocumentRow[] | null>(null);
  const [choice, setChoice] = React.useState("");
  const [otherName, setOtherName] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Only the latest request may update the list — an older, slower response (e.g. one fetched just before an
  // upload finished) must never overwrite a newer one.
  const requestSeq = React.useRef(0);
  const refresh = React.useCallback(async (idOverride?: string) => {
    const id = idOverride ?? consultancyId;
    const seq = ++requestSeq.current;
    if (!id) {
      setDocuments([]);
      return;
    }
    const res = await fetch(`/api/consultancies/${id}/documents`);
    if (seq !== requestSeq.current) return;
    if (!res.ok) {
      setDocuments([]);
      return;
    }
    const { data } = (await res.json()) as { data: DocumentRow[] };
    if (seq !== requestSeq.current) return;
    setDocuments(data);
    onCategoryUploadedChange?.(new Set(data.filter((d) => d.status === "available").map((d) => d.documentCategory)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultancyId]);

  React.useEffect(() => {
    // Fetch-on-mount / on draft change; setState only happens after the awaited fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this static check can't see the await boundary inside `refresh`
    void refresh();
  }, [refresh]);

  const currentFor = (cat: string) => documents?.find((d) => d.documentCategory === cat && d.status === "available");
  // Until the user picks a type, preselect the first mandatory document still missing (the Signed Agreement).
  const missingRequired = documents === null ? undefined : items.find((i) => i.required && !currentFor(i.category));
  const selected = choice || missingRequired?.category || "";
  const category = selected === OTHER_OPTION ? otherName.trim() : selected;
  const labelFor = (cat: string) => items.find((i) => i.category === cat)?.label ?? cat;
  // The current version of each document type uploaded so far, checklist order first, then custom-named ones.
  const order = new Map(items.map((item, index) => [item.category, index]));
  const uploaded = [...new Set((documents ?? []).map((d) => d.documentCategory))]
    .map((cat) => currentFor(cat))
    .filter((d): d is DocumentRow => Boolean(d))
    .sort((a, b) => (order.get(a.documentCategory) ?? items.length) - (order.get(b.documentCategory) ?? items.length));

  function pickFile(picked: File | undefined) {
    setError(null);
    setNotice(null);
    if (!picked) return;
    const problem = documentFileProblem(picked);
    if (problem) {
      setError(problem);
      return;
    }
    setFile(picked);
  }

  async function upload() {
    setError(null);
    setNotice(null);
    if (!category) {
      setError(selected === OTHER_OPTION ? "Type a name for this document." : "Select the document type.");
      return;
    }
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    setUploading(true);
    let uploadedTo: string | null = null;
    try {
      const targetId = consultancyId ?? (await ensureConsultancyId?.()) ?? null;
      if (!targetId) {
        setError("Couldn't save this consultancy as a draft yet. Select the Department and Academic Year on the first step, then try again.");
        return;
      }
      const doc = await uploadConsultancyDocument({ consultancyId: targetId, category, file, confidentialityLevel: DEFAULT_CONFIDENTIALITY });
      uploadedTo = targetId;
      if (doc.status === "quarantined") {
        setError("This file was flagged by the malware scan and was not accepted. Try a different file.");
      } else {
        const label = items.find((i) => i.category === category)?.label ?? category;
        setNotice(`Uploaded "${file.name}" as ${label}.`);
        setChoice("");
        setOtherName("");
        setFile(null);
      }
      await refresh(uploadedTo ?? undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(documentId: string) {
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "Could not remove this document.");
      return;
    }
    setNotice("Document removed.");
    await refresh();
  }

  async function handleDownload(documentId: string) {
    if (!(await openDocumentDownload(documentId))) {
      setError("Could not generate a download link for this file.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="doc-type">
              Document Type <span className="text-status-danger-fg">*</span>
            </Label>
            <Select value={selected} onValueChange={setChoice}>
              <SelectTrigger id="doc-type">
                <SelectValue placeholder="Select the document you are uploading" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.category} value={item.category}>
                    {item.label}
                    {currentFor(item.category) ? " (uploaded)" : ""}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_OPTION}>Other (type a name)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {selected === OTHER_OPTION && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="doc-other-name">
                Document Name <span className="text-status-danger-fg">*</span>
              </Label>
              <Input
                id="doc-other-name"
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
                maxLength={100}
                placeholder="e.g. Site Visit Report"
              />
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={(ALLOWED_DOCUMENT_CONTENT_TYPES as readonly string[]).join(",")}
          onChange={(e) => {
            pickFile(e.target.files?.[0]);
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
            pickFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 text-center transition-colors",
            dragActive ? "border-primary bg-primary-soft" : "border-border hover:border-input-border",
            "disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          <UploadCloud className="h-6 w-6 text-muted-foreground" aria-hidden />
          <span className="text-sm text-foreground">{file ? file.name : "Tap to choose a file, or drag and drop"}</span>
          <span className="text-xs text-muted-foreground">
            {file ? "Tap to choose a different file" : `${ALLOWED_EXTENSIONS_LABEL} — up to ${MAX_SIZE_LABEL}`}
          </span>
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-h-5 text-sm">
            {error && (
              <p role="alert" className="text-status-danger-fg">
                {error}
              </p>
            )}
            {notice && !error && (
              <p role="status" className="text-status-success-fg">
                {notice}
              </p>
            )}
          </div>
          <Button type="button" onClick={upload} disabled={uploading || !file || !category} className="gap-1.5">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <UploadCloud className="h-4 w-4" aria-hidden />}
            {uploading ? "Uploading…" : "Upload Document"}
          </Button>
        </div>
      </div>

      {documents === null ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        uploaded.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">Uploaded Documents ({uploaded.length})</p>
            <ul className="flex flex-col gap-2">
              {uploaded.map((doc) => (
                <li key={doc.id} className="flex flex-col gap-1">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-status-success-fg" aria-hidden />
                    {labelFor(doc.documentCategory)}
                  </span>
                  <DocumentRowView doc={doc} isCurrent onDownload={handleDownload} onRemove={handleRemove} />
                </li>
              ))}
            </ul>
          </div>
        )
      )}
    </div>
  );
}
