import { api } from "@/lib/api/client";
import type { ClosureHistoryResponse, LetterOut } from "@/types/letter";

export async function getClosureHistory(
  letterId: number
): Promise<ClosureHistoryResponse> {
  const { data } = await api.get<ClosureHistoryResponse>(
    `/api/v1/closure/letters/${letterId}/history`
  );
  return data;
}

export async function reviewSolution(
  letterId: number,
  review_comment: string
): Promise<LetterOut> {
  const { data } = await api.post<LetterOut>(
    `/api/v1/closure/letters/${letterId}/review-solution`,
    { review_comment }
  );
  return data;
}

export async function addFinalComment(
  letterId: number,
  comment: string
): Promise<LetterOut> {
  const { data } = await api.post<LetterOut>(
    `/api/v1/closure/letters/${letterId}/final-comment`,
    { comment }
  );
  return data;
}

export async function closeIssue(
  letterId: number,
  final_comment: string
): Promise<LetterOut> {
  const { data } = await api.post<LetterOut>(
    `/api/v1/closure/letters/${letterId}/close`,
    { final_comment }
  );
  return data;
}
