/** Full Indian-grouped currency, e.g. 250000 -> "₹2,50,000". */
export function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** Compact Indian currency for stat tiles, e.g. 8640000 -> "₹86.4L", 125000000 -> "₹12.5Cr". */
export function formatInrCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e7) return `₹${(value / 1e7).toFixed(abs / 1e7 >= 10 ? 0 : 1)}Cr`;
  if (abs >= 1e5) return `₹${(value / 1e5).toFixed(abs / 1e5 >= 10 ? 0 : 1)}L`;
  return formatInr(value);
}
