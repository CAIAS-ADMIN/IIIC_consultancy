import { usePathname } from "next/navigation";
import type { NavItem } from "./nav-config";

/**
 * Picks the single "most specific" nav item that matches the current path,
 * so e.g. `/consultancies/new` highlights "New Consultancy" and not also
 * "My/All Consultancies" (`/consultancies`).
 */
export function useActiveHref(items: NavItem[]): string | null {
  const pathname = usePathname();
  const matches = items.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  if (matches.length === 0) return null;
  return matches.reduce((longest, item) => (item.href.length > longest.href.length ? item : longest))
    .href;
}
