import { api } from "@/lib/api/client";
import type {
  AssignmentOut,
  ConsultantAssignmentListResponse,
} from "@/types/letter";

export async function listMyAssignments(
  limit = 20,
  offset = 0,
  filters?: {
    q?: string;
    from_office?: string;
    date_from?: string;
    date_to?: string;
    work_status?: "assigned" | "in_progress" | "resolved" | "transferred";
  }
): Promise<ConsultantAssignmentListResponse> {
  const { data } = await api.get<ConsultantAssignmentListResponse>(
    "/api/v1/consultant/assignments",
    {
      params: {
        limit,
        offset,
        q: filters?.q?.trim() || undefined,
        from_office: filters?.from_office?.trim() || undefined,
        date_from: filters?.date_from || undefined,
        date_to: filters?.date_to || undefined,
        work_status: filters?.work_status || undefined,
      },
    }
  );
  return data;
}

export async function updateAssignmentStatus(
  assignmentId: number,
  work_status: string,
  comment: string
): Promise<AssignmentOut> {
  const { data } = await api.patch<AssignmentOut>(
    `/api/v1/consultant/assignments/${assignmentId}/status`,
    { work_status, comment }
  );
  return data;
}

export async function addResolutionNote(
  assignmentId: number,
  resolution_note: string,
  comment: string
): Promise<AssignmentOut> {
  const { data } = await api.patch<AssignmentOut>(
    `/api/v1/consultant/assignments/${assignmentId}/resolution`,
    { resolution_note, comment }
  );
  return data;
}

export async function uploadSolutionFile(
  assignmentId: number,
  form: FormData
): Promise<{ file_path: string }> {
  const { data } = await api.post<{ file_path: string }>(
    `/api/v1/consultant/assignments/${assignmentId}/files`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

export async function transferAssignment(
  assignmentId: number,
  target_user_id: number,
  comment: string,
  deadline_at?: string | null
): Promise<AssignmentOut> {
  const { data } = await api.post<AssignmentOut>(
    `/api/v1/consultant/assignments/${assignmentId}/transfer`,
    { target_user_id, comment, deadline_at: deadline_at ?? undefined }
  );
  return data;
}
