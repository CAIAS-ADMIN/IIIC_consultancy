/**
 * The query-param names `/api/consultancies/search` and `/export` understand
 * (see `parseSearchFilters`). Client-safe (no db imports) so the Reports UI
 * types its filters from this list — an unknown param is silently ignored
 * by the backend, so the two must never drift. Guarded by a test.
 */
export const SEARCH_FILTER_KEYS = [
  "q",
  "consultancyCode",
  "departmentId",
  "facultyInChargeId",
  "clientName",
  "status",
  "academicYearCode",
  "createdFrom",
  "createdTo",
  "ipInvolvement",
  "resourceUsage",
  "paymentStatus",
] as const;

export type SearchFilterKey = (typeof SEARCH_FILTER_KEYS)[number];
