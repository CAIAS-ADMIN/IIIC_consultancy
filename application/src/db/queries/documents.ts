import { and, desc, eq, getTableColumns } from "drizzle-orm";
import { db } from "@/db";
import { documents, users } from "@/db/schema";

export async function getDocumentById(id: string) {
  return db.query.documents.findFirst({ where: eq(documents.id, id) });
}

/** Every version of every category on record for a consultancy (or just one category), newest version first within each — the raw material for a version-history UI. */
export async function listDocumentsForConsultancy(consultancyId: string, category?: string) {
  const conditions = [eq(documents.consultancyId, consultancyId)];
  if (category) conditions.push(eq(documents.documentCategory, category));

  return db
    .select({ ...getTableColumns(documents), uploadedByName: users.name })
    .from(documents)
    .leftJoin(users, eq(users.id, documents.uploadedBy))
    .where(and(...conditions))
    .orderBy(documents.documentCategory, desc(documents.version));
}
