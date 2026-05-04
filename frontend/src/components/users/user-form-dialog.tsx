"use client";

import { useEffect, useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { createUser, updateUser } from "@/lib/api/users";
import type {
  DepartmentOut,
  RoleOut,
  UserOut,
  UserUpdatePayload,
} from "@/types/user";

type UserFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  user: UserOut | null;
  roles: RoleOut[];
  departments: DepartmentOut[];
  onSuccess: () => void;
};

const defaultStatus = "active";

export function UserFormDialog({
  open,
  onOpenChange,
  mode,
  user,
  roles,
  departments,
  onSuccess,
}: UserFormDialogProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(defaultStatus);
  const [departmentId, setDepartmentId] = useState<string>("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<number>>(
    () => new Set()
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPassword("");
    if (mode === "edit" && user) {
      setEmail(user.email);
      setFullName(user.full_name);
      setStatus(user.status);
      setDepartmentId(user.department ? String(user.department.id) : "");
      setSelectedRoleIds(new Set(user.roles.map((r) => r.id)));
    } else {
      setEmail("");
      setFullName("");
      setStatus(defaultStatus);
      setDepartmentId("");
      setSelectedRoleIds(new Set());
    }
  }, [open, mode, user]);

  function toggleRole(id: number, checked: boolean) {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const role_ids = Array.from(selectedRoleIds);
    const dept =
      departmentId === "" ? null : (Number(departmentId) as number | null);

    setPending(true);
    try {
      if (mode === "create") {
        if (!password || password.length < 8) {
          setError("Password must be at least 8 characters.");
          return;
        }
        await createUser({
          email: email.trim(),
          full_name: fullName.trim(),
          password,
          role_ids,
          department_id: dept,
          status,
        });
      } else if (user) {
        const payload: UserUpdatePayload = {
          full_name: fullName.trim(),
          role_ids,
          department_id: dept,
          status,
        };
        if (password.trim().length > 0) {
          if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
          }
          payload.password = password;
        }
        await updateUser(user.id, payload);
      }
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="flex max-h-[90vh] flex-col">
          <DialogHeader className="border-b p-4 pb-3">
            <DialogTitle>
              {mode === "create" ? "Create user" : "Edit user"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Add a new account. Email must be unique."
                : "Update profile, roles, department, or status."}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[55vh] flex-1 px-4">
            <div className="space-y-4 py-4">
              {error ? (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              ) : null}

              {mode === "create" ? (
                <FormField id="email" label="Email" error={null}>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </FormField>
              ) : (
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input value={email} disabled readOnly className="bg-muted" />
                </div>
              )}

              <FormField id="full_name" label="Full name" error={null}>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  minLength={2}
                />
              </FormField>

              <FormField
                id="password"
                label={mode === "create" ? "Password" : "New password (optional)"}
                hint={
                  mode === "edit"
                    ? "Leave blank to keep the current password."
                    : "Minimum 8 characters."
                }
                error={null}
              >
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={mode === "create"}
                  minLength={mode === "create" ? 8 : undefined}
                />
              </FormField>

              <div className="grid gap-2">
                <Label htmlFor="dept">Department</Label>
                <select
                  id="dept"
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                >
                  <option value="">None</option>
                  {departments.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Roles</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {roles.map((role) => (
                    <label
                      key={role.id}
                      className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={selectedRoleIds.has(role.id)}
                        onCheckedChange={(checked) =>
                          toggleRole(role.id, checked === true)
                        }
                      />
                      <span>{role.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="border-t p-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : mode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
