import { api } from "@/lib/api/client";
import type { NoticeListResponse, NoticeOut, NoticeUpsertPayload } from "@/types/notice";

export async function getNotices(limit = 20, offset = 0): Promise<NoticeListResponse> {
  const { data } = await api.get<NoticeListResponse>("/api/v1/notices", {
    params: { limit, offset },
  });
  return data;
}

export async function createNotice(payload: NoticeUpsertPayload): Promise<NoticeOut> {
  const { data } = await api.post<NoticeOut>("/api/v1/notices", payload);
  return data;
}

export async function updateNotice(noticeId: number, payload: NoticeUpsertPayload): Promise<NoticeOut> {
  const { data } = await api.put<NoticeOut>(`/api/v1/notices/${noticeId}`, payload);
  return data;
}

export async function deleteNotice(noticeId: number): Promise<void> {
  await api.delete(`/api/v1/notices/${noticeId}`);
}
