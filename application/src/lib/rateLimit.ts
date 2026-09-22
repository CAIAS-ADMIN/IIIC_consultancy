type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

/**
 * In-memory fixed-window rate limiter — sufficient for this app's single-instance
 * dev/Dokploy deployment (see Phase 11 notes on the job scheduler assumption). A
 * horizontally-scaled deployment would need a shared store (e.g. Redis) instead.
 *
 * Returns true if the call under `key` is allowed, false if the limit was exceeded.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (existing.count >= limit) {
    return false;
  }

  existing.count += 1;
  return true;
}
