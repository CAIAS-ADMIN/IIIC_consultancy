import type { NextRequest } from "next/server";
import { requireJobsSecret, JobsUnauthorizedError } from "@/lib/jobs/auth";
import { runDailyChecks } from "@/lib/jobs/daily-checks";

/**
 * POST /api/jobs/daily-checks — hit by a system-level or Dokploy-scheduled
 * cron, secured by the `x-jobs-secret` header (not a public endpoint, not a
 * user session). Safe to invoke manually/repeatedly — every run computes
 * fresh from current data.
 */
export async function POST(request: NextRequest) {
  try {
    requireJobsSecret(request);
  } catch (error) {
    if (error instanceof JobsUnauthorizedError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }

  const summary = await runDailyChecks();
  return Response.json({ data: summary });
}
