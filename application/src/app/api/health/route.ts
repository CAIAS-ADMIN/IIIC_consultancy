import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function GET() {
  try {
    const start = Date.now();
    await db.execute(sql`select 1`);
    return Response.json({
      status: "ok",
      db: "connected",
      latencyMs: Date.now() - start,
    });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        db: "unreachable",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
