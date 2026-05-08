import { api } from "@/lib/api/client";
import type { RoleOut } from "@/types/user";

export type ScreenColumnOut = { key: string; label: string; group?: string | null };

export type RolePermissionMatrixOut = {
  roles: RoleOut[];
  columns: ScreenColumnOut[];
  grants: Record<string, string[]>;
};

export type RolePermissionMatrixUpdate = {
  grants: Record<string, string[]>;
};

/** Keys shown as checkboxes in Role Management (granular view/action permissions). */
export function matrixColumnKeySet(columns: ScreenColumnOut[]): Set<string> {
  return new Set(columns.map((c) => c.key));
}

/**
 * Compare/save using only matrix column keys. The API may include legacy module tokens
 * (e.g. `consultant`, `closure`) in expanded responses; those are not editable checkboxes
 * and must not block dirty detection or be relied on for persistence after granular saves.
 */
export function grantsForMatrixColumnsOnly(
  grants: Record<string, string[]>,
  roleIds: string[],
  allowed: Set<string>
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const id of roleIds) {
    const list = (grants[id] ?? []).filter((k) => allowed.has(k));
    list.sort();
    out[id] = list;
  }
  return out;
}

export function buildPermissionMatrixSavePayload(
  data: RolePermissionMatrixOut,
  draft: Record<string, string[]>
): Record<string, string[]> {
  const allowed = matrixColumnKeySet(data.columns);
  const grants: Record<string, string[]> = {};
  for (const role of data.roles) {
    const id = String(role.id);
    const raw = draft[id] ?? data.grants[id] ?? [];
    const merged = new Set<string>();
    for (const k of raw) {
      if (allowed.has(k)) merged.add(k);
    }
    grants[id] = Array.from(merged).sort();
  }
  return grants;
}

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

export type RoleCreatePayload = {
  name: string;
  code?: string;
  description?: string;
  clone_from_role_id?: number;
  is_active?: boolean;
};

export async function createRole(payload: RoleCreatePayload): Promise<RoleOut> {
  const { data } = await api.post<RoleOut>("/api/v1/role-permissions/roles", {
    name: payload.name,
    ...(payload.code !== undefined && payload.code !== "" ? { code: payload.code } : {}),
    ...(payload.description ? { description: payload.description } : {}),
    ...(payload.clone_from_role_id != null
      ? { clone_from_role_id: payload.clone_from_role_id }
      : {}),
    is_active: payload.is_active ?? true,
  });
  return data;
}
