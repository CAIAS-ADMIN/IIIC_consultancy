import { sql } from "drizzle-orm";
import type { Transaction } from "@/db";
import { consultancyIdSequences } from "@/db/schema";

/**
 * Atomically allocates the next sequence number for an academic year and
 * returns the formatted Consultancy ID: CAIAS/CON/{academic_year}/{seq}
 * (seq zero-padded to 5 digits). Must be called inside the same transaction
 * that flips the consultancy to `submitted`, so a rollback also releases the
 * sequence value.
 *
 * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` is a single atomic
 * statement — under Postgres's row-level locking, two concurrent
 * transactions racing on the same academic year serialize here instead of
 * both reading the same "last" value, so no duplicate/skipped IDs.
 */
export async function allocateConsultancyId(tx: Transaction, academicYearCode: string): Promise<string> {
  const [row] = await tx
    .insert(consultancyIdSequences)
    .values({ academicYearCode, lastSequence: 1 })
    .onConflictDoUpdate({
      target: consultancyIdSequences.academicYearCode,
      set: { lastSequence: sql`${consultancyIdSequences.lastSequence} + 1` },
    })
    .returning();

  const sequence = String(row.lastSequence).padStart(5, "0");
  return `CAIAS/CON/${academicYearCode}/${sequence}`;
}
