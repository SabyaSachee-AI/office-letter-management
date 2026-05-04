import { api } from "@/lib/api/client";
import type { AssignmentOut, AssignmentTrackingResponse } from "@/types/letter";

export async function getAssignmentTracking(
  letterId: number
): Promise<AssignmentTrackingResponse> {
  const { data } = await api.get<AssignmentTrackingResponse>(
    `/api/v1/assignments/letters/${letterId}/tracking`
  );
  return data;
}

export async function assignConsultant(
  letterId: number,
  body: {
    consultant_id: number;
    deadline_at: string;
    comment: string;
  }
): Promise<AssignmentOut> {
  const { data } = await api.post<AssignmentOut>(
    `/api/v1/assignments/letters/${letterId}/assign`,
    body
  );
  return data;
}

export async function reassignConsultant(
  letterId: number,
  body: {
    consultant_id: number;
    deadline_at: string;
    comment: string;
  }
): Promise<AssignmentOut> {
  const { data } = await api.post<AssignmentOut>(
    `/api/v1/assignments/letters/${letterId}/reassign`,
    body
  );
  return data;
}
