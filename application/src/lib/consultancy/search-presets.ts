/**
 * Named list views behind the spec's dashboard KPIs (§67) — each KPI tile
 * drills down to `/consultancies?preset=<key>`, and the tile's count and the
 * list use the same definition (see `presetCondition` in search.ts).
 * Client-safe: no db imports.
 */
export const SEARCH_PRESETS = {
  pending_verification: "Pending Verification",
  approval_pending: "Approval Pending",
  closure_pending: "Closure Pending",
  finance_pending: "Finance Pending",
  closure_due: "Closure Due",
  pending_actions: "Pending Actions",
} as const;

export type SearchPreset = keyof typeof SEARCH_PRESETS;

export function isSearchPreset(value: string | undefined | null): value is SearchPreset {
  return Boolean(value && value in SEARCH_PRESETS);
}
