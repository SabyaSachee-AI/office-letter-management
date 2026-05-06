"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
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
import {
  fetchPermissionMatrix,
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
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<RolePermissionMatrixOut | null>(null);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const m = await fetchPermissionMatrix();
      setData(m);
      setDraft(cloneGrants(m.grants));
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!isSystemAdmin(user)) {
      router.replace("/dashboard/access-denied");
      return;
    }
    void load();
  }, [loading, user, router, load]);

  const dirty = useMemo(() => {
    if (!data) return false;
    const a = data.grants;
    const b = draft;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const x = new Set(a[k] ?? []);
      const y = new Set(b[k] ?? []);
      if (x.size !== y.size) return true;
      for (const s of x) if (!y.has(s)) return true;
    }
    return false;
  }, [data, draft]);

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
    setPending(true);
    setError(null);
    try {
      await savePermissionMatrix({ grants: draft });
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e));
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
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setPending(false);
    }
  }

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

      <div className="overflow-x-auto rounded-md border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="min-w-[160px] font-semibold">Role</TableHead>
              {data.columns.map((c) => (
                <TableHead key={c.key} className="text-center text-xs font-semibold whitespace-nowrap">
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">{role.name}</TableCell>
                {data.columns.map((col) => {
                  const rid = String(role.id);
                  const on = (draft[rid] ?? []).includes(col.key);
                  return (
                    <TableCell key={col.key} className="text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={on}
                          disabled={pending}
                          onCheckedChange={(v) => toggleCell(rid, col.key, v === true)}
                          aria-label={`${role.name} — ${col.label}`}
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

      <p className="text-muted-foreground text-xs">
        “Role management” (this screen) is granted only via the System Admin role on the API. Matrix
        columns match application modules.
      </p>
    </div>
  );
}
