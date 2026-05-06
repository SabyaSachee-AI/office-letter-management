import { api } from "@/lib/api/client";
import type {
  DepartmentOut,
  RoleOut,
  UserCreatePayload,
  UserListResponse,
  UserOut,
  UserUpdatePayload,
} from "@/types/user";

export async function fetchRoles(): Promise<RoleOut[]> {
  const { data } = await api.get<RoleOut[]>("/api/v1/reference/roles");
  return data;
}

let _departmentsInflight: Promise<DepartmentOut[]> | null = null;

/** Departments rarely change; dedupe concurrent calls while a fetch is in flight. */
export async function fetchDepartments(): Promise<DepartmentOut[]> {
  if (!_departmentsInflight) {
    _departmentsInflight = api
      .get<DepartmentOut[]>("/api/v1/reference/departments")
      .then(({ data }) => data)
      .finally(() => {
        _departmentsInflight = null;
      });
  }
  return _departmentsInflight;
}

export type ListUsersParams = {
  q?: string;
  role_id?: number;
  department_id?: number;
  status?: string;
  limit?: number;
  offset?: number;
};

export async function listUsers(
  params: ListUsersParams
): Promise<UserListResponse> {
  const { data } = await api.get<UserListResponse>("/api/v1/users", {
    params: {
      q: params.q || undefined,
      role_id: params.role_id,
      department_id: params.department_id,
      status: params.status,
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
    },
  });
  return data;
}

/** Active Team Leaders for Consultant reporting line (Users admin). */
export async function listTeamLeaders(
  departmentId?: number
): Promise<UserOut[]> {
  const { data } = await api.get<UserListResponse>(
    "/api/v1/users/team-leaders",
    {
      params: {
        ...(departmentId != null && departmentId >= 1
          ? { department_id: departmentId }
          : {}),
        limit: 200,
      },
    }
  );
  return data.items;
}

export async function createUser(payload: UserCreatePayload): Promise<UserOut> {
  const { data } = await api.post<UserOut>("/api/v1/users", payload);
  return data;
}

export async function updateUser(
  userId: number,
  payload: UserUpdatePayload
): Promise<UserOut> {
  const { data } = await api.put<UserOut>(`/api/v1/users/${userId}`, payload);
  return data;
}

export async function deleteUser(userId: number): Promise<void> {
  await api.delete(`/api/v1/users/${userId}`);
}

/** Team Leader / System Admin: consultants in a department for assignment (requires Assignment screen). */
export async function listConsultantsForAssignment(
  departmentId: number,
  q?: string
): Promise<UserOut[]> {
  const { data } = await api.get<UserListResponse>("/api/v1/users/consultants", {
    params: {
      department_id: departmentId,
      q: q || undefined,
      limit: 100,
    },
  });
  return data.items;
}
