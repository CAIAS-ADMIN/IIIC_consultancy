import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

const JOBS_SECRET_HEADER = "x-jobs-secret";

export class JobsUnauthorizedError extends Error {
  constructor() {
    super("Unauthorized: missing or incorrect jobs shared secret");
    this.name = "JobsUnauthorizedError";
  }
}

/**
 * Gate for scheduled-job endpoints (e.g. `/api/jobs/daily-checks`) — a shared
 * secret header, not a user session, since the caller is a cron trigger, not
 * a logged-in person. An unset `JOBS_SHARED_SECRET` always rejects rather
 * than accepting an empty header value.
 */
export function requireJobsSecret(request: NextRequest): void {
  const provided = request.headers.get(JOBS_SECRET_HEADER);
  if (!env.JOBS_SHARED_SECRET || !provided || provided !== env.JOBS_SHARED_SECRET) {
    throw new JobsUnauthorizedError();
  }
}
