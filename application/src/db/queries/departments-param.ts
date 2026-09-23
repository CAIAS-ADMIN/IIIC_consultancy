import { eq } from "drizzle-orm";
import { db } from "@/db";
import { departments } from "@/db/schema";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Turns a `?department=` search param into a real department id, or
 * `undefined` ("all departments") for anything missing, malformed, or
 * unknown — a hand-edited URL must never 500 (bad uuid cast) or silently
 * show an empty page for a department that doesn't exist.
 */
export async function resolveDepartmentParam(raw: string | string[] | undefined): Promise<string | undefined> {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !UUID_RE.test(value)) return undefined;
  const row = await db.query.departments.findFirst({ where: eq(departments.id, value), columns: { id: true } });
  return row?.id;
}
