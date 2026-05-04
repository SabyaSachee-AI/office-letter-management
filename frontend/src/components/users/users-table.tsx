"use client";

import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { UserRoleBadges } from "@/components/users/user-role-badges";
import { UserRowActions } from "@/components/users/user-row-actions";
import { UserStatusBadge } from "@/components/users/user-status-badge";
import type { UserOut } from "@/types/user";

type UsersTableProps = {
  users: UserOut[];
  isLoading: boolean;
  canManage: boolean;
  currentUserId: number;
  onEdit: (user: UserOut) => void;
  onDelete: (user: UserOut) => void;
};

export function UsersTable({
  users,
  isLoading,
  canManage,
  currentUserId,
  onEdit,
  onDelete,
}: UsersTableProps) {
  const columns: DataTableColumn<UserOut>[] = [
    {
      id: "name",
      header: "Name",
      cell: (u) => (
        <div className="flex flex-col">
          <span className="font-medium">{u.full_name}</span>
          <span className="text-muted-foreground text-xs">{u.email}</span>
        </div>
      ),
    },
    {
      id: "roles",
      header: "Roles",
      className: "max-w-[240px]",
      cell: (u) => <UserRoleBadges roles={u.roles} />,
    },
    {
      id: "department",
      header: "Department",
      cell: (u) => (
        <span className="text-sm">
          {u.department?.name ?? (
            <span className="text-muted-foreground">—</span>
          )}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (u) => <UserStatusBadge status={u.status} />,
    },
    {
      id: "actions",
      header: "",
      className: "w-12 text-right",
      cell: (u) => (
        <UserRowActions
          user={u}
          canManage={canManage}
          disableDelete={u.id === currentUserId}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={users}
      getRowKey={(u) => u.id}
      isLoading={isLoading}
      emptyContent={
        <EmptyState
          title="No users found"
          description="Try adjusting filters or search, or create a new user if you have admin access."
        />
      }
    />
  );
}
