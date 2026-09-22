import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

declare global {
  var __caiasPgClient: ReturnType<typeof postgres> | undefined;
}

const client =
  global.__caiasPgClient ??
  postgres(env.DATABASE_URL, {
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  global.__caiasPgClient = client;
}

export const db = drizzle(client, { schema });
export type Database = typeof db;
/** The `tx` passed into `db.transaction(async (tx) => ...)` — not structurally the same type as `Database`. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Accepts either the top-level `db` or a transaction — for helpers callable from inside or outside a transaction. */
export type Executor = Database | Transaction;

/** Closes the pooled connection — call from test teardown so the process can exit. */
export async function closeDb() {
  await client.end({ timeout: 5 });
}
