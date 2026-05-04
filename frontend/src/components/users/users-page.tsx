"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorBanner } from "@/components/data/error-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/data/pagination-bar";
import { UserDeleteDialog } from "@/components/users/user-delete-dialog";
import { UserFiltersBar, type UserFiltersState } from "@/components/users/user-filters-bar";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { UsersTable } from "@/components/users/users-table";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { getApiErrorMessage } from "@/lib/api/error-message";
import {
  fetchDepartments,
  fetchRoles,
  listUsers,
} from "@/lib/api/users";
import type { DepartmentOut, RoleOut, UserOut } from "@/types/user";

const emptyFilters: UserFiltersState = {
  q: "",
  roleId: "",
  departmentId: "",
  status: "",
};

const PAGE_SIZE = 20;

export function UsersPage() {
  const { user: me } = useAuth();
  const admin = isAdmin(me);

  const [draftFilters, setDraftFilters] = useState<UserFiltersState>(emptyFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<UserFiltersState>(emptyFilters);
  const [page, setPage] = useState(0);

  const [roles, setRoles] = useState<RoleOut[]>([]);
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [users, setUsers] = useState<UserOut[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [metaLoading, setMetaLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingUser, setEditingUser] = useState<UserOut | null>(null);

  const [deleteUserState, setDeleteUserState] = useState<UserOut | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    setMetaError(null);
    try {
      const [r, d] = await Promise.all([fetchRoles(), fetchDepartments()]);
      setRoles(r);
      setDepartments(d);
    } catch (e) {
      setMetaError(getApiErrorMessage(e));
    } finally {
      setMetaLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await listUsers({
        q: appliedFilters.q.trim() || undefined,
        role_id: appliedFilters.roleId
          ? Number(appliedFilters.roleId)
          : undefined,
        department_id: appliedFilters.departmentId
          ? Number(appliedFilters.departmentId)
          : undefined,
        status: appliedFilters.status || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setUsers(res.items);
      setTotal(res.total);
    } catch (e) {
      setListError(getApiErrorMessage(e));
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function handleApplyFilters() {
    setAppliedFilters({ ...draftFilters });
    setPage(0);
  }

  function handleResetFilters() {
    const cleared = { ...emptyFilters };
    setDraftFilters(cleared);
    setAppliedFilters(cleared);
    setPage(0);
  }

  function openCreate() {
    setFormMode("create");
    setEditingUser(null);
    setFormOpen(true);
  }

  function openEdit(u: UserOut) {
    setFormMode("edit");
    setEditingUser(u);
    setFormOpen(true);
  }

  function openDelete(u: UserOut) {
    setDeleteUserState(u);
    setDeleteOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Search and manage accounts. Admins can create, edit, and delete users. Managers can browse the directory."
        actions={
          admin ? (
            <Button type="button" onClick={openCreate}>
              Add user
            </Button>
          ) : null
        }
      />

      {metaError ? <ErrorBanner message={metaError} /> : metaLoading ? (
        <p className="text-muted-foreground text-sm">Loading filters…</p>
      ) : (
        <UserFiltersBar
          value={draftFilters}
          onChange={setDraftFilters}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
          roles={roles}
          departments={departments}
        />
      )}

      {listError ? <ErrorBanner message={listError} /> : null}

      <UsersTable
        users={users}
        isLoading={loading || metaLoading}
        canManage={admin}
        currentUserId={me?.id ?? 0}
        onEdit={openEdit}
        onDelete={openDelete}
      />

      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        user={editingUser}
        roles={roles}
        departments={departments}
        onSuccess={() => void loadUsers()}
      />

      <UserDeleteDialog
        user={deleteUserState}
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setDeleteUserState(null);
        }}
        onDeleted={() => void loadUsers()}
      />
    </div>
  );
}
