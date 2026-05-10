export type NotificationOut = {
  id: number;
  title: string;
  message: string;
  type: string;
  link_url: string | null;
  link_path?: string | null;
  event_code?: string | null;
  route_module?: string | null;
  entity_type?: string | null;
  entity_id?: number | null;
  is_read: boolean;
  created_at: string;
  letter_id: number | null;
};

export type NotificationListResponse = {
  items: NotificationOut[];
  total: number;
  limit: number;
  offset: number;
  /** All unread notifications for the user (not limited by page size). */
  unread_total: number;
};
