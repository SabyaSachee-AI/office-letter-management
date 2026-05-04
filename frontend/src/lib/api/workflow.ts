import { api } from "@/lib/api/client";
import type { ApprovalQueueResponse, LetterOut } from "@/types/letter";

export async function getApprovalQueue(
  limit = 20,
  offset = 0
): Promise<ApprovalQueueResponse> {
  const { data } = await api.get<ApprovalQueueResponse>(
    "/api/v1/workflow/queue",
    { params: { limit, offset } }
  );
  return data;
}

export async function approveLetter(
  letterId: number,
  comment: string
): Promise<LetterOut> {
  const { data } = await api.post<LetterOut>(
    `/api/v1/workflow/letters/${letterId}/approve`,
    { comment }
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
