/** Case-insensitive "does any of these fields contain the query" — for filtering lists already in memory. */
export function matchesQuery(query: string | undefined, ...fields: (string | null | undefined)[]): boolean {
  const needle = query?.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => f?.toLowerCase().includes(needle));
}
