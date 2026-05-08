"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
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
import { Checkbox } from "@/components/ui/checkbox";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { createRole } from "@/lib/api/role-permissions";
import { deriveRoleCodeFromName } from "@/lib/role-code";
import { toastError, toastSuccess } from "@/lib/toast";
import type { RoleOut } from "@/types/user";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: RoleOut[];
  onCreated: () => Promise<void>;
};

export function CreateRoleDialog({ open, onOpenChange, roles, onCreated }: Props) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [cloneFromId, setCloneFromId] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setCode("");
    setCodeTouched(false);
    setDescription("");
    setCloneFromId("");
    setIsActive(true);
  }, [open]);

  useEffect(() => {
    if (codeTouched || !name.trim()) return;
    setCode(deriveRoleCodeFromName(name));
  }, [name, codeTouched]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createRole({
        name: name.trim(),
        code: code.trim() || undefined,
        description: description.trim() || undefined,
        clone_from_role_id: cloneFromId ? Number(cloneFromId) : undefined,
        is_active: isActive,
      });
      toastSuccess("Role created successfully.");
      onOpenChange(false);
      await onCreated();
    } catch (err) {
      toastError(getApiErrorMessage(err));
      console.error("[role-management] Create role failed", err);
    } finally {
      setSubmitting(false);
    }
  }

  const sortedCloneRoles = [...roles].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-border bg-card shadow-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg tracking-tight">Create new role</DialogTitle>
          <DialogDescription>
            Add a custom role for future assignments. System roles cannot be recreated here.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4 pt-1">
          <div className="grid gap-2">
            <Label htmlFor="role-name">Role name</Label>
            <Input
              id="role-name"
              required
              autoComplete="off"
              placeholder="e.g. Auditor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              className="bg-background"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role-code">Role code</Label>
            <Input
              id="role-code"
              autoComplete="off"
              placeholder="Auto-generated from name"
              value={code}
              onChange={(e) => {
                setCodeTouched(true);
                setCode(e.target.value.toUpperCase().replace(/\s+/g, "_"));
              }}
              disabled={submitting}
              className="bg-background font-mono text-xs"
            />
            <p className="text-muted-foreground text-xs">
              Uppercase letters, numbers, underscores. Leave blank to derive from the role name.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role-desc">Description</Label>
            <textarea
              id="role-desc"
              rows={3}
              placeholder="Optional purpose or scope for this role"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[72px] w-full rounded-lg border px-2.5 py-2 text-sm shadow-none outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="clone-from">Clone permissions from</Label>
            <select
              id="clone-from"
              aria-label="Clone permissions from existing role"
              value={cloneFromId}
              onChange={(e) => setCloneFromId(e.target.value)}
              disabled={submitting}
              className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm shadow-none outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              <option value="">None — start with defaults / empty matrix</option>
              {sortedCloneRoles.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.name}
                  {r.code ? ` (${r.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="role-active"
              checked={isActive}
              disabled={submitting}
              onCheckedChange={(v) => setIsActive(v === true)}
            />
            <Label htmlFor="role-active" className="cursor-pointer font-normal">
              Active (inactive roles grant no permissions)
            </Label>
          </div>

          <DialogFooter className="gap-2 pt-2 sm:justify-end">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "Creating…" : "Create role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
