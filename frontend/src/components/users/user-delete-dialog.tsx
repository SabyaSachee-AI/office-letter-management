"use client";

import { useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { toastError, toastSuccess } from "@/lib/toast";
import { deleteUser } from "@/lib/api/users";
import type { UserOut } from "@/types/user";

type UserDeleteDialogProps = {
  user: UserOut | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

export function UserDeleteDialog({
  user,
  open,
  onOpenChange,
  onDeleted,
}: UserDeleteDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!user) return;
    setError(null);
    setPending(true);
    try {
      const result = await deleteUser(user.id);
      toastSuccess(result.message);
      onOpenChange(false);
      onDeleted();
    } catch (e) {
      const m = getApiErrorMessage(e);
      setError(m);
      toastError(m);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete user</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove{" "}
            <span className="text-foreground font-medium">
              {user?.full_name}
            </span>{" "}
            ({user?.email}). This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => void handleDelete()}
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
