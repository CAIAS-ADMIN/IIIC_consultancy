/**
 * Human-readable message from an API error body. Routes return either
 * `{ error: "message" }` or, for zod validation failures,
 * `{ error: <zod flatten()> }` — the latter is turned into
 * "field: problem; field: problem" instead of being shown as raw JSON.
 */
export function apiErrorMessage(body: unknown, fallback = "Something went wrong. Please try again."): string {
  const error = (body as { error?: unknown } | null)?.error;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const { formErrors = [], fieldErrors = {} } = error as { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };
    const messages = [
      ...formErrors,
      ...Object.entries(fieldErrors).flatMap(([field, errs]) => (errs?.length ? [`${field}: ${errs.join(", ")}`] : [])),
    ];
    if (messages.length > 0) return messages.join("; ");
  }
  return fallback;
}
