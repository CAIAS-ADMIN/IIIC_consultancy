import {
  LayoutDashboard,
  FilePlus,
  FileText,
  Folder,
  BarChart3,
  ClipboardCheck,
  Building2,
  BookMarked,
  Database,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/db/schema/enums";

export type NavItem = {
  label: string;
  /** Used in the mobile bottom tab bar, where 5 columns at 375px leave ~70px per label. */
  shortLabel?: string;
  href: string;
  icon: LucideIcon;
};

/** Roles that get the oversight chrome (department/academic-year switcher, admin-flavored nav). */
export const OVERSIGHT_ROLES: Role[] = [
  "hod",
  "iiic_admin",
  "finance",
  "competent_authority",
  "system_admin",
  "audit_readonly",
];

export function isOversightRole(roles: Role[]): boolean {
  return roles.some((role) => OVERSIGHT_ROLES.includes(role));
}

const FACULTY_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "New Consultancy", shortLabel: "New", href: "/consultancies/new", icon: FilePlus },
  { label: "My Consultancies", shortLabel: "Mine", href: "/consultancies", icon: FileText },
  { label: "Documents", href: "/documents", icon: Folder },
  { label: "Reports", href: "/reports", icon: BarChart3 },
];

/** hod / iiic_admin — admin-oriented set, incl. New Consultancy per the backend role matrix. */
const OVERSIGHT_CORE_NAV: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "New Consultancy", shortLabel: "New", href: "/consultancies/new", icon: FilePlus },
  { label: "Verification Queue", shortLabel: "Queue", href: "/verification-queue", icon: ClipboardCheck },
  { label: "All Consultancies", shortLabel: "All", href: "/consultancies", icon: FileText },
  { label: "Register", href: "/consultancies/register", icon: BookMarked },
  { label: "Departments", href: "/departments", icon: Building2 },
  { label: "Reports", href: "/reports", icon: BarChart3 },
];

/** system_admin — the oversight set plus Master Data, which must be absent from every other role's nav. */
const SYSTEM_ADMIN_NAV: NavItem[] = [
  ...OVERSIGHT_CORE_NAV,
  { label: "Master Data", shortLabel: "Data", href: "/master-data", icon: Database },
];

/**
 * competent_authority — a real, configurable `approval_stage_configs`
 * approver role (Phase 6/Phase 5-frontend), so unlike finance/audit_readonly
 * it needs a way to actually reach the queue it approves from. No "New
 * Consultancy"/"Departments" though — those aren't this role's job.
 */
const COMPETENT_AUTHORITY_NAV: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Verification Queue", shortLabel: "Queue", href: "/verification-queue", icon: ClipboardCheck },
  { label: "All Consultancies", shortLabel: "All", href: "/consultancies", icon: FileText },
  { label: "Register", href: "/consultancies/register", icon: BookMarked },
  { label: "Reports", href: "/reports", icon: BarChart3 },
];

/** finance, audit_readonly — minimal, read-oriented set (finance also has no write-nav items here; its write UI lives on the consultancy detail page in later phases). */
const MINIMAL_NAV: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "All Consultancies", shortLabel: "All", href: "/consultancies", icon: FileText },
  { label: "Register", href: "/consultancies/register", icon: BookMarked },
  { label: "Reports", href: "/reports", icon: BarChart3 },
];

/**
 * Priority-ordered role groups. A user with multiple roles gets the
 * richest-matching nav (first group in this list whose role set intersects
 * theirs) rather than a union of items across groups.
 */
const NAV_GROUPS: { roles: Role[]; items: NavItem[] }[] = [
  { roles: ["system_admin"], items: SYSTEM_ADMIN_NAV },
  { roles: ["iiic_admin", "hod"], items: OVERSIGHT_CORE_NAV },
  { roles: ["competent_authority"], items: COMPETENT_AUTHORITY_NAV },
  { roles: ["finance", "audit_readonly"], items: MINIMAL_NAV },
  { roles: ["faculty"], items: FACULTY_NAV },
];

/** Resolves the nav item list for a user's roles. Falls back to the faculty set if no known role matches. */
export function getNavItems(roles: Role[]): NavItem[] {
  for (const group of NAV_GROUPS) {
    if (group.roles.some((role) => roles.includes(role))) {
      return group.items;
    }
  }
  return FACULTY_NAV;
}

/** Number of items shown directly in the mobile bottom tab bar before the rest collapse into "More". */
export const MOBILE_PRIMARY_COUNT = 4;
