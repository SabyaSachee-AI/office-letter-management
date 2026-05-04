import { api } from "@/lib/api/client";
import type {
  AssignmentOut,
  ConsultantAssignmentListResponse,
} from "@/types/letter";

export async function listMyAssignments(
  limit = 20,
  offset = 0
): Promise<ConsultantAssignmentListResponse> {
  const { data } = await api.get<ConsultantAssignmentListResponse>(
    "/api/v1/consultant/assignments",
    { params: { limit, offset } }
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
  target_consultant_id: number,
  comment: string
): Promise<AssignmentOut> {
  const { data } = await api.post<AssignmentOut>(
    `/api/v1/consultant/assignments/${assignmentId}/transfer`,
    { target_consultant_id, comment }
  );
  return data;
}
