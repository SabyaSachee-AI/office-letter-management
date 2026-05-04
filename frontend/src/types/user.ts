export type RoleOut = {
  id: number;
  name: string;
};

export type DepartmentOut = {
  id: number;
  name: string;
  code: string;
};

export type UserOut = {
  id: number;
  email: string;
  full_name: string;
  status: string;
  department: DepartmentOut | null;
  roles: RoleOut[];
};

export type UserListResponse = {
  items: UserOut[];
  total: number;
  limit: number;
  offset: number;
};

export type UserCreatePayload = {
  email: string;
  full_name: string;
  password: string;
  role_ids: number[];
  department_id: number | null;
  status: string;
};

export type UserUpdatePayload = {
  full_name?: string;
  password?: string;
  role_ids?: number[];
  department_id?: number | null;
  status?: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};
