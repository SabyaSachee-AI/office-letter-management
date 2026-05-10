import { api } from "@/lib/api/client";
import type {
  AssignmentOut,
  AssignmentTrackingResponse,
  LetterListResponse,
} from "@/types/letter";

export type ListAssignmentQueueParams = {
  limit?: number;
  offset?: number;
  status?: string;
  priority?: string;
  department_id?: number;
  q?: string;
  date_from?: string;
  date_to?: string;
  from_office?: string;
};

export async function listAssignmentQueue(
  params: ListAssignmentQueueParams
): Promise<LetterListResponse> {
  const { data } = await api.get<LetterListResponse>("/api/v1/assignments/queue", {
    params: {
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
      status: params.status || undefined,
      priority: params.priority || undefined,
      department_id: params.department_id,
      q: params.q?.trim() || undefined,
      date_from: params.date_from || undefined,
      date_to: params.date_to || undefined,
      from_office: params.from_office?.trim() || undefined,
    },
  });
  return data;
}

export async function getAssignmentTracking(
  letterId: number
): Promise<AssignmentTrackingResponse> {
  const { data } = await api.get<AssignmentTrackingResponse>(
    `/api/v1/assignments/letters/${letterId}/tracking`
  );
  return data;
}

export type RoutingAssignBody = {
  target_user_id: number;
  deadline_at?: string | null;
  comment: string;
};

export async function assignConsultant(
  letterId: number,
  body: RoutingAssignBody
): Promise<AssignmentOut> {
  const { data } = await api.post<AssignmentOut>(
    `/api/v1/assignments/letters/${letterId}/assign`,
    body
  );
  return data;
}

export async function reassignConsultant(
  letterId: number,
  body: RoutingAssignBody
): Promise<AssignmentOut> {
  const { data } = await api.post<AssignmentOut>(
    `/api/v1/assignments/letters/${letterId}/reassign`,
    body
  );
  return data;
}
