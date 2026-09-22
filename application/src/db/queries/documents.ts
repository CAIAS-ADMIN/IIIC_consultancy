import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";

export async function getDocumentById(id: string) {
  return db.query.documents.findFirst({ where: eq(documents.id, id) });
}
