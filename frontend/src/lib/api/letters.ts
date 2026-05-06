import { api } from "@/lib/api/client";
import type {
  ClosureHistoryResponse,
  LetterListResponse,
  LetterOut,
} from "@/types/letter";

export type ListLettersParams = {
  limit?: number;
  offset?: number;
  status?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  department_id?: number;
  /** Search serial, memo no., subject, received from */
  q?: string;
  unassigned_only?: boolean;
  date_from?: string;
  date_to?: string;
  from_office?: string;
};

export async function listLetters(
  params: ListLettersParams
): Promise<LetterListResponse> {
  const { data } = await api.get<LetterListResponse>("/api/v1/letters", {
    params: {
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
      status: params.status || undefined,
      priority: params.priority || undefined,
      department_id: params.department_id,
      q: params.q?.trim() || undefined,
      unassigned_only: params.unassigned_only || undefined,
      date_from: params.date_from || undefined,
      date_to: params.date_to || undefined,
      from_office: params.from_office?.trim() || undefined,
    },
  });
  return data;
}

export async function getLetter(letterId: number): Promise<LetterOut> {
  const { data } = await api.get<LetterOut>(`/api/v1/letters/${letterId}`);
  return data;
}

export type LetterAdminUpdatePayload = {
  memo_no?: string | null;
  subject: string;
  received_from: string;
  priority: "low" | "normal" | "high" | "urgent";
};

export async function updateLetterAdmin(
  letterId: number,
  payload: LetterAdminUpdatePayload
): Promise<LetterOut> {
  const { data } = await api.put<LetterOut>(`/api/v1/letters/${letterId}`, payload);
  return data;
}

export async function deleteLetterAdmin(letterId: number): Promise<void> {
  await api.delete(`/api/v1/letters/${letterId}`);
}

export async function createLetter(form: FormData): Promise<LetterOut> {
  const { data } = await api.post<LetterOut>("/api/v1/letters", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getLetterActionHistory(
  letterId: number
): Promise<ClosureHistoryResponse> {
  const { data } = await api.get<ClosureHistoryResponse>(
    `/api/v1/letters/${letterId}/action-history`
  );
  return data;
}

/** Authenticated binary download for preview / save-as (same RBAC as letter detail). */
export async function fetchLetterAttachmentBlob(letterId: number): Promise<Blob> {
  const { data } = await api.get<Blob>(`/api/v1/letters/${letterId}/attachment`, {
    responseType: "blob",
  });
  return data;
}
