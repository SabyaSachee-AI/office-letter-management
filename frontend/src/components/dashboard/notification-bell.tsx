"use client";

import { Bell } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { normalizeNotificationLink } from "@/lib/notification-link";
import type { NotificationOut } from "@/types/notifications";

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationOut[]>([]);
  const [total, setTotal] = useState(0);
  /** Global unread count from API; `-1` means not loaded yet (use first-page estimate). */
  const [unreadTotal, setUnreadTotal] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [toastItem, setToastItem] = useState<NotificationOut | null>(null);
  const prevUnreadRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listNotifications({
        limit: 12,
        offset: 0,
        unread_only: unreadOnly,
      });
      setItems(data.items);
      setTotal(data.total);
      setUnreadTotal(typeof data.unread_total === "number" ? data.unread_total : 0);
      setError(null);
      const unreadOnPage = data.items.reduce((n, item) => n + (item.is_read ? 0 : 1), 0);
      const unreadAll =
        typeof data.unread_total === "number" ? data.unread_total : unreadOnPage;
      if (prevUnreadRef.current > 0 && unreadAll > prevUnreadRef.current) {
        const firstUnread = data.items.find((x) => !x.is_read) || null;
        setToastItem(firstUnread);
        if (toastTimerRef.current != null) {
          window.clearTimeout(toastTimerRef.current);
        }
        toastTimerRef.current = window.setTimeout(() => setToastItem(null), 4500);
      }
      prevUnreadRef.current = unreadAll;
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }, [unreadOnly]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 30000);
    return () => {
      window.clearInterval(timer);
      if (toastTimerRef.current != null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, [load]);

  const unreadCount = useMemo(() => {
    if (unreadTotal >= 0) return unreadTotal;
    return items.reduce((n, item) => n + (item.is_read ? 0 : 1), 0);
  }, [items, unreadTotal]);

  async function openNotification(item: NotificationOut) {
    if (!item.is_read) {
      try {
        await markNotificationRead(item.id);
      } catch {
        /* noop */
      }
      setItems((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, is_read: true } : x))
      );
      setUnreadTotal((u) => (u >= 0 ? Math.max(0, u - 1) : u));
    }
    router.push(
      normalizeNotificationLink(item.link_url, {
        type: item.type,
        letterId: item.letter_id,
        title: item.title,
        linkUrl: item.link_url ?? item.link_path ?? null,
        routeModule: item.route_module ?? null,
        eventCode: item.event_code ?? null,
      })
    );
  }

  async function markAllRead() {
    setBusy(true);
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Notifications">
            <div className="relative">
              <Bell className="size-5" />
              {unreadCount > 0 ? (
                <span className="absolute -top-2 -right-2 min-w-4 rounded-full bg-red-600 px-1 text-[10px] text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </div>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-[360px] max-h-[420px] overflow-auto p-1.5">
        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-medium">Notifications</p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={unreadOnly ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setUnreadOnly((v) => !v)}
            >
              Unread only
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={busy || unreadCount === 0}
              onClick={() => void markAllRead()}
            >
              Mark all read
            </Button>
          </div>
        </div>
        <DropdownMenuSeparator />
        {error ? <p className="text-destructive px-2 py-1.5 text-xs">{error}</p> : null}
        {!items.length ? (
          <p className="text-muted-foreground px-2 py-2 text-sm">No notifications.</p>
        ) : (
          items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="items-start py-2"
              onClick={() => void openNotification(n)}
            >
              <div className="space-y-0.5">
                <p className={`text-sm ${n.is_read ? "font-normal" : "font-semibold"}`}>
                  {n.title}
                </p>
                <p className="text-muted-foreground text-xs leading-snug">{n.message}</p>
                <p className="text-muted-foreground text-[11px]">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2 py-1 text-[11px] text-slate-500">
          <span>Total: {total}</span>
          <button
            type="button"
            className="text-[#123f63] underline underline-offset-2"
            onClick={() =>
              router.push(
                unreadOnly ? "/dashboard/notifications?unread=1" : "/dashboard/notifications"
              )
            }
          >
            View all notifications
          </button>
        </div>
      </DropdownMenuContent>
      {toastItem ? (
        <div className="fixed right-4 bottom-4 z-[70] w-[320px] rounded-md border border-slate-200 bg-white p-3 shadow-lg">
          <p className="text-sm font-semibold">{toastItem.title}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">{toastItem.message}</p>
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setToastItem(null)}
            >
              Dismiss
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void openNotification(toastItem)}
            >
              Open
            </Button>
          </div>
        </div>
      ) : null}
    </DropdownMenu>
  );
}
