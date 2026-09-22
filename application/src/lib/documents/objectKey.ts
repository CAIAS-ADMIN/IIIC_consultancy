import { randomUUID } from "node:crypto";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180);
}

/** Every upload gets a fresh, unguessable object key — versions never share or overwrite a key. */
export function buildObjectKey(consultancyId: string, documentCategory: string, originalFileName: string): string {
  return `consultancies/${consultancyId}/${slugify(documentCategory)}/${randomUUID()}-${sanitizeFileName(originalFileName)}`;
}
