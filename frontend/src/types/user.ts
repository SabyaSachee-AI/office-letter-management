export type RoleOut = {
  id: number;
  name: string;
  sort_order?: number;
  code?: string;
  description?: string | null;
  is_system_role?: boolean;
  is_active?: boolean;
  created_at?: string | null;
};

export type DepartmentOut = {
  id: number;
  name: string;
  code: string;
  sort_order?: number;
  is_legacy?: boolean;
};

export type UserOut = {
  id: number;
  email: string;
  username?: string | null;
  full_name: string;
  employee_id?: string | null;
  nid?: string | null;
  phone_number?: string | null;
  designation?: string | null;
  status: string;
  department: DepartmentOut | null;
  approval_department?: DepartmentOut | null;
  team_department?: DepartmentOut | null;
  receiving_department?: DepartmentOut | null;
  consultant_type?: string | null;
  reporting_team_leader_id?: number | null;
  roles: RoleOut[];
  allowed_screens?: string[];
};

export type UserListResponse = {
  items: UserOut[];
  total: number;
  limit: number;
  offset: number;
};

export type UserCreatePayload = {
  email: string;
  username: string;
  full_name: string;
  password: string;
  nid: string;
  phone_number: string;
  employee_id?: string | null;
  designation?: string | null;
  role_ids: number[];
  department_id?: number | null;
  status: string;
  approval_department_id?: number | null;
  team_department_id?: number | null;
  receiving_department_id?: number | null;
  consultant_type?: string | null;
  reporting_team_leader_id?: number | null;
};

export type UserUpdatePayload = {
  email?: string;
  username?: string;
  full_name?: string;
  password?: string;
  nid?: string | null;
  phone_number?: string | null;
  employee_id?: string | null;
  designation?: string | null;
  role_ids?: number[];
  department_id?: number | null;
  status?: string;
  approval_department_id?: number | null;
  team_department_id?: number | null;
  receiving_department_id?: number | null;
  consultant_type?: string | null;
  reporting_team_leader_id?: number | null;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};
