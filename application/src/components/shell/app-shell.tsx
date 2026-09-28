"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { LogOut, Menu } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { SessionExpiredDialog } from "./session-expired-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Role } from "@/db/schema/enums";
import { getNavItems, MOBILE_PRIMARY_COUNT, type NavItem } from "./nav-config";
import { useActiveHref } from "./use-active-href";

export type ShellUser = {
  name: string | null;
  email: string | null;
  roles: Role[];
};

const ROLE_LABELS: Record<Role, string> = {
  faculty: "Faculty",
  hod: "HOD",
  iiic_admin: "IIIC Admin",
  finance: "Finance",
  competent_authority: "Competent Authority",
  system_admin: "System Admin",
  audit_readonly: "Audit (Read-only)",
};

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary-soft text-primary-soft-foreground" : "text-foreground hover:bg-background"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {item.label}
    </Link>
  );
}

function SignOutButton({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("justify-start px-2 text-muted-foreground", className)}
      onClick={() => signOut({ callbackUrl: "/" })}
    >
      <LogOut className="h-4 w-4" aria-hidden />
      Sign out
    </Button>
  );
}

/**
 * Authenticated app shell: fixed sidebar + top bar on desktop (`md:` and
 * up), bottom tab bar + "More" sheet on mobile. Both markups render in the
 * DOM at all times — CSS breakpoints decide which shows, no JS resize
 * listener (same technique as Phase 0's DataTable).
 */
export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const items = getNavItems(user.roles);
  const activeHref = useActiveHref(items);
  const primaryRole = user.roles[0];

  const primaryItems = items.slice(0, MOBILE_PRIMARY_COUNT);
  const overflowItems = items.slice(MOBILE_PRIMARY_COUNT);
  const mobileColumns = primaryItems.length + 1; // + the "More" tab, always present (also hosts sign-out)

  return (
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row print:block print:h-auto print:overflow-visible">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex print:hidden">
        <div className="flex items-center gap-2 px-5 py-5">
          <Image src="/brand/iiic-logo.webp" alt="IIIC" width={32} height={32} unoptimized />
          <span className="text-sm font-bold text-foreground">IIIC Consultancy</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {items.map((item) => (
            <SidebarLink key={item.href} item={item} active={item.href === activeHref} />
          ))}
        </nav>
        <div className="border-t border-border p-4">
          <p className="truncate text-sm font-medium text-foreground">{user.name ?? user.email}</p>
          {primaryRole && <p className="text-xs text-muted-foreground">{ROLE_LABELS[primaryRole]}</p>}
          <SignOutButton className="mt-2 w-full" />
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden print:overflow-visible">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 md:justify-end md:px-6 print:hidden">
          <div className="flex items-center gap-2 md:hidden">
            <Image src="/brand/iiic-logo.webp" alt="IIIC" width={24} height={24} unoptimized />
            <span className="text-sm font-bold text-foreground">IIIC Consultancy</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </header>

        {/* `relative` keeps absolutely-positioned descendants (e.g. the hidden native inputs Radix checkboxes/selects
            render) inside this scroll area — otherwise they're placed against the page and stretch it past the viewport. */}
        <main className="relative flex-1 overflow-y-auto p-4 pb-20 md:p-8 md:pb-8 print:overflow-visible print:p-0">{children}</main>
        <SessionExpiredDialog />
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-card md:hidden print:hidden"
        style={{ gridTemplateColumns: `repeat(${mobileColumns}, minmax(0, 1fr))` }}
      >
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="w-full truncate text-center">{item.shortLabel ?? item.label}</span>
            </Link>
          );
        })}

        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium text-muted-foreground"
            >
              <Menu className="h-5 w-5" aria-hidden />
              More
            </button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetTitle>More</SheetTitle>
            <div className="flex flex-col gap-1">
              {overflowItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-background"
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
              <div className="mt-2 border-t border-border pt-3">
                <p className="truncate px-3 text-sm font-medium text-foreground">{user.name ?? user.email}</p>
                {primaryRole && <p className="px-3 text-xs text-muted-foreground">{ROLE_LABELS[primaryRole]}</p>}
                <SignOutButton className="mt-1 w-full" />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}
