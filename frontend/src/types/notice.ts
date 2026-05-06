export type NoticeOut = {
  id: number;
  title: string;
  message: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  is_active: boolean;
  is_pinned: boolean;
};

export type NoticeListResponse = {
  items: NoticeOut[];
  total: number;
  limit: number;
  offset: number;
};

export type NoticeUpsertPayload = {
  title: string;
  message: string;
  expires_at?: string | null;
  is_active: boolean;
  is_pinned: boolean;
};
