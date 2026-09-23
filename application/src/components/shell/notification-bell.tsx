"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, Inbox } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
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
  const [open, setOpen] = React.useState(false);

  const refresh = React.useCallback(async () => {
    // Background poll: a failed tick just keeps the last known list; the next tick retries.
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const body = await res.json();
      setNotifications(body.data);
      setUnreadCount(body.unreadCount);
    } catch {
      // offline / server restarting — ignore, retry on next interval
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- polling loop, setState only happens after each awaited fetch resolves
    void refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

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
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-danger-fg px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetTitle>Notifications</SheetTitle>
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
      </SheetContent>
    </Sheet>
  );
}
