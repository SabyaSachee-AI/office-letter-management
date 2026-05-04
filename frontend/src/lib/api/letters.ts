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
  department_id?: number;
};

export async function listLetters(
  params: ListLettersParams
): Promise<LetterListResponse> {
  const { data } = await api.get<LetterListResponse>("/api/v1/letters", {
    params: {
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
      status: params.status || undefined,
      department_id: params.department_id,
    },
  });
  return data;
}

export async function getLetter(letterId: number): Promise<LetterOut> {
  const { data } = await api.get<LetterOut>(`/api/v1/letters/${letterId}`);
  return data;
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
