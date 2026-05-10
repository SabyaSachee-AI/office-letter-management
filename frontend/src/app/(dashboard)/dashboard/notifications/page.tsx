"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ErrorBanner } from "@/components/data/error-banner";
import { PaginationBar } from "@/components/data/pagination-bar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { normalizeNotificationLink } from "@/lib/notification-link";
import type { NotificationOut } from "@/types/notifications";

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<NotificationOut[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(searchParams.get("unread") === "1");

  useEffect(() => {
    const q = searchParams.get("unread") === "1";
    setUnreadOnly(q);
  }, [searchParams]);

  function setUnreadInUrl(next: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("unread", "1");
    else params.delete("unread");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listNotifications({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        unread_only: unreadOnly,
      });
      setRows(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(getApiErrorMessage(e));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, unreadOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openOne(n: NotificationOut) {
    if (!n.is_read) {
      try {
        await markNotificationRead(n.id);
      } catch {
        /* noop */
      }
    }
    router.push(
      normalizeNotificationLink(n.link_url, {
        type: n.type,
        letterId: n.letter_id,
        title: n.title,
        linkUrl: n.link_url ?? n.link_path ?? null,
        routeModule: n.route_module ?? null,
        eventCode: n.event_code ?? null,
      })
    );
  }

  async function markAllRead() {
    setBusy(true);
    try {
      await markAllNotificationsRead();
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Workflow alerts that need your attention."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={unreadOnly ? "default" : "outline"}
              onClick={() => {
                setUnreadInUrl(!unreadOnly);
                setPage(0);
              }}
            >
              Unread only
            </Button>
            <Button type="button" variant="outline" onClick={() => void markAllRead()} disabled={busy}>
              Mark all read
            </Button>
          </div>
        }
      />
      {error ? <ErrorBanner message={error} /> : null}
      <div className="rounded-lg border border-slate-200/80">
        {loading ? (
          <p className="text-muted-foreground p-4 text-sm">Loading notifications…</p>
        ) : !rows.length ? (
          <p className="text-muted-foreground p-4 text-sm">No notifications.</p>
        ) : (
          <ul className="divide-y divide-slate-200/70">
            {rows.map((n) => (
              <li key={n.id} className="p-3">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => void openOne(n)}
                >
                  <p className={n.is_read ? "font-medium" : "font-semibold"}>{n.title}</p>
                  <p className="text-muted-foreground text-sm">{n.message}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <PaginationBar page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
    </div>
  );
}
