/**
 * There's no `academic_year` master-data category in the backend (only
 * `academicYearCode` free text on each consultancy, assigned by whoever
 * registers it) — so "current" is derived from today's date rather than
 * looked up. CAIAS's academic year runs June-May, matching the "2026-27"
 * style codes already on record.
 */
export function getCurrentAcademicYearCode(date: Date = new Date()): string {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 5 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}
