import { api } from "@/lib/api/client";
import type { RoleOut } from "@/types/user";

export type ScreenColumnOut = { key: string; label: string };

export type RolePermissionMatrixOut = {
  roles: RoleOut[];
  columns: ScreenColumnOut[];
  grants: Record<string, string[]>;
};

export type RolePermissionMatrixUpdate = {
  grants: Record<string, string[]>;
};

export async function fetchPermissionMatrix(): Promise<RolePermissionMatrixOut> {
  const { data } = await api.get<RolePermissionMatrixOut>(
    "/api/v1/role-permissions/matrix"
  );
  return data;
}

export async function savePermissionMatrix(
  payload: RolePermissionMatrixUpdate
): Promise<void> {
  await api.put("/api/v1/role-permissions/matrix", payload);
}

export async function resetPermissionMatrix(): Promise<void> {
  await api.post("/api/v1/role-permissions/reset");
}
