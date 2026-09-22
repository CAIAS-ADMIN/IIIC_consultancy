import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { masterData } from "@/db/schema";

export async function listMasterData(category?: string) {
  if (category) {
    return db.query.masterData.findMany({
      where: eq(masterData.category, category),
      orderBy: (row, { asc }) => [asc(row.sortOrder), asc(row.label)],
    });
  }
  return db.query.masterData.findMany({
    orderBy: (row, { asc }) => [asc(row.category), asc(row.sortOrder), asc(row.label)],
  });
}

export async function getMasterDataById(id: string) {
  return db.query.masterData.findFirst({ where: eq(masterData.id, id) });
}

export async function getMasterDataByCode(category: string, code: string) {
  return db.query.masterData.findFirst({
    where: and(eq(masterData.category, category), eq(masterData.code, code)),
  });
}
