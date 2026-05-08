"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { CreateRoleDialog } from "@/components/role-management/create-role-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/auth-context";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  buildPermissionMatrixSavePayload,
  fetchPermissionMatrix,
  grantsForMatrixColumnsOnly,
  matrixColumnKeySet,
  resetPermissionMatrix,
  savePermissionMatrix,
  type RolePermissionMatrixOut,
} from "@/lib/api/role-permissions";
import { isSystemAdmin } from "@/lib/auth/roles";
import { useRouter } from "next/navigation";

function cloneGrants(g: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(g)) {
    out[k] = [...v];
  }
  return out;
}

export default function RoleManagementPage() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<RolePermissionMatrixOut | null>(null);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setError(null);
    try {
      const m = await fetchPermissionMatrix();
      if (seq !== loadSeq.current) return;
      setData(m);
      setDraft(cloneGrants(m.grants));
    } catch (e) {
      if (seq !== loadSeq.current) return;
      setError(getApiErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!isSystemAdmin(user)) {
      router.replace("/dashboard/access-denied");
      return;
    }
    void load();
    // Only re-run when the signed-in user id changes; omitting `user` from deps avoids wiping the draft on /users/me refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id, router, load]);

  const matrixKeySet = useMemo(
    () => (data ? matrixColumnKeySet(data.columns) : new Set<string>()),
    [data]
  );

  const dirty = useMemo(() => {
    if (!data) return false;
    const ids = data.roles.map((r) => String(r.id));
    const a = grantsForMatrixColumnsOnly(data.grants, ids, matrixKeySet);
    const b = grantsForMatrixColumnsOnly(draft, ids, matrixKeySet);
    return JSON.stringify(a) !== JSON.stringify(b);
  }, [data, draft, matrixKeySet]);

  function toggleCell(roleId: string, screenKey: string, checked: boolean) {
    setDraft((prev) => {
      const next = cloneGrants(prev);
      const cur = new Set(next[roleId] ?? []);
      if (checked) cur.add(screenKey);
      else cur.delete(screenKey);
      next[roleId] = Array.from(cur).sort();
      return next;
    });
  }

  async function onSave() {
    if (!data) return;
    setPending(true);
    setError(null);
    try {
      const grants = buildPermissionMatrixSavePayload(data, draft);
      await savePermissionMatrix({ grants });
      await load();
      await refreshUser();
      toastSuccess("Role permissions updated successfully.");
    } catch (e) {
      console.error("[role-management] Save failed", e);
      const m = getApiErrorMessage(e);
      setError(m);
      toastError(m);
    } finally {
      setPending(false);
    }
  }

  async function onReset() {
    if (!globalThis.confirm("Reset all roles to default screen access?")) return;
    setPending(true);
    setError(null);
    try {
      await resetPermissionMatrix();
      await load();
      await refreshUser();
      toastSuccess("Permissions reset to defaults.");
    } catch (e) {
      console.error("[role-management] Reset failed", e);
      const m = getApiErrorMessage(e);
      setError(m);
      toastError(m);
    } finally {
      setPending(false);
    }
  }

  const columnGroups = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, typeof data.columns>();
    for (const col of data.columns) {
      const g = col.group?.trim() || "General";
      const bucket = m.get(g);
      if (bucket) bucket.push(col);
      else m.set(g, [col]);
    }
    return [...m.entries()];
  }, [data]);

  if (loading || !user || !isSystemAdmin(user)) {
    return null;
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Role management" description="Screen access by role" />
        {error ? <p className="text-destructive text-sm">{error}</p> : <p className="text-sm">Loading…</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Role management"
        description="Control which screens each role can access. Changes apply to the sidebar, routes, and API checks."
      />

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void onSave()} disabled={pending || !dirty}>
            Save changes
          </Button>
          <Button type="button" variant="outline" onClick={() => void onReset()} disabled={pending}>
            Reset to defaults
          </Button>
          <Button type="button" variant="ghost" onClick={() => void load()} disabled={pending}>
            Reload
          </Button>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="border border-border"
          onClick={() => setCreateRoleOpen(true)}
          disabled={pending}
        >
          + Add New Role
        </Button>
      </div>

      <CreateRoleDialog
        open={createRoleOpen}
        onOpenChange={setCreateRoleOpen}
        roles={data.roles}
        onCreated={async () => {
          await load();
          await refreshUser();
        }}
      />

      <div className="space-y-8">
        {columnGroups.map(([groupName, cols]) => (
          <div key={groupName} className="space-y-2">
            <h3 className="text-foreground text-sm font-semibold tracking-tight">{groupName}</h3>
            <div className="overflow-x-auto rounded-md border border-border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="min-w-[160px] font-semibold">Role</TableHead>
                    {cols.map((c) => (
                      <TableHead
                        key={c.key}
                        className="text-center text-xs font-semibold whitespace-nowrap"
                      >
                        {c.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.roles.map((role) => (
                    <TableRow key={`${groupName}-${role.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-0.5">
                          <span>{role.name}</span>
                          {role.code ? (
                            <span className="text-muted-foreground font-mono text-xs font-normal tracking-wide">
                              {role.code}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      {cols.map((col) => {
                        const rid = String(role.id);
                        const on = (draft[rid] ?? []).includes(col.key);
                        return (
                          <TableCell key={col.key} className="text-center">
                            <div className="flex justify-center">
                              <Checkbox
                                checked={on}
                                disabled={pending}
                                onCheckedChange={(checked) =>
                                  toggleCell(rid, col.key, checked === true)
                                }
                                aria-label={`${role.name} — ${groupName} — ${col.label}`}
                              />
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
      </div>

      <p className="text-muted-foreground text-xs">
        “Role management” requires <span className="font-medium">role_management:view</span> plus the System Admin role. Legacy module grants (e.g. approval, closure) still expand to the matching granular permissions until you migrate each role.
      </p>
    </div>
  );
}
