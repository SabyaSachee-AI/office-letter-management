import { api } from "@/lib/api/client";
import type { NotificationListResponse, NotificationOut } from "@/types/notifications";

export async function listNotifications(params?: {
  limit?: number;
  offset?: number;
  unread_only?: boolean;
}): Promise<NotificationListResponse> {
  const { data } = await api.get<NotificationListResponse>("/api/v1/activity/notifications", {
    params: {
      limit: params?.limit ?? 12,
      offset: params?.offset ?? 0,
      unread_only: params?.unread_only ?? false,
    },
  });
  return data;
}

export async function markNotificationRead(notificationId: number): Promise<NotificationOut> {
  const { data } = await api.patch<NotificationOut>(
    `/api/v1/activity/notifications/${notificationId}/read`
  );
  return data;
}

export async function markAllNotificationsRead(): Promise<{ marked_count: number }> {
  const { data } = await api.patch<{ marked_count: number }>(
    "/api/v1/activity/notifications/mark-all-read"
  );
  return data;
}
