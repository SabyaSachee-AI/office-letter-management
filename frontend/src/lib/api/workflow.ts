import { api } from "@/lib/api/client";
import type { ApprovalQueueResponse, LetterOut } from "@/types/letter";

export async function getApprovalQueue(
  limit = 20,
  offset = 0,
  filters?: {
    q?: string;
    from_office?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    department_id?: number;
  }
): Promise<ApprovalQueueResponse> {
  const { data } = await api.get<ApprovalQueueResponse>(
    "/api/v1/workflow/queue",
    {
      params: {
        limit,
        offset,
        q: filters?.q?.trim() || undefined,
        from_office: filters?.from_office?.trim() || undefined,
        status: filters?.status || undefined,
        date_from: filters?.date_from || undefined,
        date_to: filters?.date_to || undefined,
        department_id: filters?.department_id,
      },
    }
  );
  return data;
}

export async function approveLetter(
  letterId: number,
  comment: string,
  targetDepartmentId?: number,
  priority?: "low" | "normal" | "high" | "urgent"
): Promise<LetterOut> {
  const { data } = await api.post<LetterOut>(
    `/api/v1/workflow/letters/${letterId}/approve`,
    {
      comment,
      target_department_id: targetDepartmentId,
      priority,
    }
  );
  return data;
}

export async function rejectLetter(
  letterId: number,
  comment: string
): Promise<LetterOut> {
  const { data } = await api.post<LetterOut>(
    `/api/v1/workflow/letters/${letterId}/reject`,
    { comment }
  );
  return data;
}

export async function returnLetter(
  letterId: number,
  comment: string
): Promise<LetterOut> {
  const { data } = await api.post<LetterOut>(
    `/api/v1/workflow/letters/${letterId}/return`,
    { comment }
  );
  return data;
}

export async function routeLetter(
  letterId: number,
  targetDepartmentId: number,
  comment: string
): Promise<LetterOut> {
  const { data } = await api.post<LetterOut>(
    `/api/v1/workflow/letters/${letterId}/route`,
    { target_department_id: targetDepartmentId, comment }
  );
  return data;
}
