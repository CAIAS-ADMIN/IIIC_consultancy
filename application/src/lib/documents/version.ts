import { and, desc, eq } from "drizzle-orm";
import { documents } from "@/db/schema";
import type { Transaction } from "@/db";

/**
 * Locks the latest row for this (consultancy, category) pair and returns the
 * next version number. Must run inside the same transaction that inserts the
 * new `documents` row, so two concurrent re-uploads of the same category
 * can't compute the same version.
 */
export async function nextDocumentVersion(
  tx: Transaction,
  consultancyId: string,
  documentCategory: string
): Promise<number> {
  const [latest] = await tx
    .select({ version: documents.version })
    .from(documents)
    .where(and(eq(documents.consultancyId, consultancyId), eq(documents.documentCategory, documentCategory)))
    .orderBy(desc(documents.version))
    .limit(1)
    .for("update");

  return (latest?.version ?? 0) + 1;
}
