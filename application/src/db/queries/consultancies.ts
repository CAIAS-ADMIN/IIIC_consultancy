import { eq } from "drizzle-orm";
import { db } from "@/db";
import { consultancies, clients, agreements } from "@/db/schema";

export async function getConsultancyById(id: string) {
  return db.query.consultancies.findFirst({ where: eq(consultancies.id, id) });
}

export async function getClientByConsultancyId(consultancyId: string) {
  return db.query.clients.findFirst({ where: eq(clients.consultancyId, consultancyId) });
}

export async function getAgreementByConsultancyId(consultancyId: string) {
  return db.query.agreements.findFirst({ where: eq(agreements.consultancyId, consultancyId) });
}

export async function hasAvailableDocument(consultancyId: string, category: string) {
  const row = await db.query.documents.findFirst({
    where: (doc, { and, eq }) =>
      and(eq(doc.consultancyId, consultancyId), eq(doc.documentCategory, category), eq(doc.status, "available")),
  });
  return Boolean(row);
}
