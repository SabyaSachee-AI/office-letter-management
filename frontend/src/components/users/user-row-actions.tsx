"use client";

import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserOut } from "@/types/user";

type UserRowActionsProps = {
  user: UserOut;
  canManage: boolean;
  disableDelete?: boolean;
  onEdit: (user: UserOut) => void;
  onDelete: (user: UserOut) => void;
};

export function UserRowActions({
  user,
  canManage,
  disableDelete,
  onEdit,
  onDelete,
}: UserRowActionsProps) {
  if (!canManage) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="hover:bg-muted inline-flex size-8 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Actions for ${user.full_name}`}
      >
        <MoreHorizontalIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onEdit(user)}>
          <PencilIcon className="size-4" />
          Edit
        </DropdownMenuItem>
        {!disableDelete ? (
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onDelete(user)}
          >
            <Trash2Icon className="size-4" />
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
