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
  // Portal spec §62 additions
  "clientTypeCode",
  "consultancyCategoryCode",
  "startFrom",
  "startTo",
  "completionFrom",
  "completionTo",
  "agreementReference",
  /** "include" | "only" — archived records are left out unless asked for (spec §68). */
  "archived",
  /** A named KPI view — see search-presets.ts. */
  "preset",
] as const;

export type SearchFilterKey = (typeof SEARCH_FILTER_KEYS)[number];
