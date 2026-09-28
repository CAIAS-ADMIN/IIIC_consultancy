"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, Inbox, CheckCheck } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { notifySessionExpired } from "./session-expired-dialog";
import { cn } from "@/lib/utils";

type NotificationRow = {
  id: string;
  message: string;
  type: string;
  consultancyId: string | null;
  isRead: boolean;
  createdAt: string;
};

const POLL_INTERVAL_MS = 30_000;
const PAGE_SIZE = 20;
/** Server-side cap per request (see /api/notifications). */
const MAX_PAGE = 50;

/**
 * The bell polls `/api/notifications` (no websocket infra in this app, per
 * the backend's own Phase 11 "no built-in scheduler" decision) and reuses
 * the existing `Sheet` primitive for the panel — its `side="right"` markup
 * (`w-full max-w-sm`) already reads as a desktop slide-over/dropdown and as
 * a near-full-screen mobile panel with zero extra breakpoint logic.
 */
export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = React.useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [expired, setExpired] = React.useState(false);
  // How many rows the panel currently shows, so a poll refreshes all of them rather than collapsing back to page one.
  const loadedCountRef = React.useRef(PAGE_SIZE);

  const fetchPage = React.useCallback(async (offset: number, limit: number) => {
    const res = await fetch(`/api/notifications?offset=${offset}&limit=${limit}`);
    if (res.status === 401) {
      setExpired(true);
      notifySessionExpired();
      return null;
    }
    if (!res.ok) return null;
    return (await res.json()) as { data: NotificationRow[]; hasMore: boolean; unreadCount: number };
  }, []);

  const refresh = React.useCallback(async () => {
    // Background poll: a failed tick just keeps the last known list; the next tick retries.
    try {
      const body = await fetchPage(0, Math.min(Math.max(loadedCountRef.current, PAGE_SIZE), MAX_PAGE));
      if (!body) return;
      setNotifications(body.data);
      setHasMore(body.hasMore);
      setUnreadCount(body.unreadCount);
      loadedCountRef.current = body.data.length;
    } catch {
      // offline / server restarting — ignore, retry on next interval
    }
  }, [fetchPage]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const body = await fetchPage(notifications.length, PAGE_SIZE);
      if (!body) return;
      setNotifications((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        const next = [...prev, ...body.data.filter((n) => !seen.has(n.id))];
        loadedCountRef.current = next.length;
        return next;
      });
      setHasMore(body.hasMore);
      setUnreadCount(body.unreadCount);
    } catch {
      // leave the button in place so the user can retry
    } finally {
      setLoadingMore(false);
    }
  }

  async function markAllAsRead() {
    try {
      await fetch("/api/notifications", { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // best effort
    }
  }

  React.useEffect(() => {
    // Once the session is gone every poll would just 401 again — stop until the user signs back in.
    if (expired) return;
    void refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh, expired]);

  async function handleClick(n: NotificationRow) {
    if (!n.isRead) {
      // Marking read is best-effort — it must never block taking the user to the consultancy.
      await fetch(`/api/notifications/${n.id}`, { method: "PATCH" }).catch(() => undefined);
      void refresh();
    }
    setOpen(false);
    if (n.consultancyId) router.push(`/consultancies/${n.consultancyId}`);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          title="Notifications"
          className="relative flex h-11 w-11 items-center md:h-9 md:w-9 justify-center rounded-md text-muted-foreground hover:bg-background"
        >
          <Bell className="h-5 w-5" aria-hidden />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-danger-fg px-1 text-[10px] font-semibold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </button>
      </SheetTrigger>
      <SheetContent side="right">
        <div className="flex items-center justify-between border-b pb-3 pr-6">
          <SheetTitle className="text-base font-semibold">Notifications</SheetTitle>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-8 gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all as read
            </Button>
          )}
        </div>
        {notifications.length === 0 ? (
          <EmptyState icon={Inbox} title="You're all caught up" description="No notifications yet." className="mt-6" />
        ) : (
          <ul className="mt-4 flex flex-col gap-1">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  className={cn(
                    "flex w-full flex-col items-start gap-1 rounded-md p-3 text-left text-sm hover:bg-background",
                    !n.isRead && "bg-primary-soft"
                  )}
                >
                  <span className="text-foreground">{n.message}</span>
                  <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {hasMore && (
          <Button type="button" variant="secondary" className="mt-3 w-full" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}
