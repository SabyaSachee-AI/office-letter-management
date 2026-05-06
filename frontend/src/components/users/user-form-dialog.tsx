"use client";

import { useEffect, useMemo, useState } from "react";

import { FormField } from "@/components/forms/form-field";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { toastError, toastSuccess } from "@/lib/toast";
import { createUser, listTeamLeaders, updateUser } from "@/lib/api/users";
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

const ROLE_TEAM_LEADER = new Set(["Team Leader"]);
const ROLE_CONSULTANT = new Set(["Consultant"]);
const ROLE_SYSTEM_ADMIN = new Set(["System Admin", "Admin"]);

function roleById(roles: RoleOut[], id: number): RoleOut | undefined {
  return roles.find((r) => r.id === id);
}

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
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [nid, setNid] = useState("");
  const [phone, setPhone] = useState("");
  const [designation, setDesignation] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState(defaultStatus);
  const [departmentId, setDepartmentId] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const [teamDeptId, setTeamDeptId] = useState("");
  const [consultantType, setConsultantType] = useState("");
  const [reportingLeaderId, setReportingLeaderId] = useState("");
  const [teamLeaders, setTeamLeaders] = useState<UserOut[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRole = roleId ? roleById(roles, Number(roleId)) : undefined;
  const selectedRoleName = selectedRole?.name ?? "";

  const showTeamDept = ROLE_TEAM_LEADER.has(selectedRoleName);
  const showConsultantFields = ROLE_CONSULTANT.has(selectedRoleName);
  const showPrimaryDepartmentField =
    ROLE_TEAM_LEADER.has(selectedRoleName) ||
    ROLE_CONSULTANT.has(selectedRoleName) ||
    ROLE_SYSTEM_ADMIN.has(selectedRoleName);
  const requiresPrimaryDepartment =
    ROLE_TEAM_LEADER.has(selectedRoleName) || ROLE_CONSULTANT.has(selectedRoleName);

  const departmentOptions = useMemo(() => {
    const selectable = departments.filter((d) => !d.is_legacy);
    if (mode === "edit" && user?.department?.is_legacy) {
      const has = selectable.some((d) => d.id === user.department!.id);
      if (!has && user.department) return [user.department, ...selectable];
    }
    return selectable;
  }, [departments, mode, user?.department]);

  useEffect(() => {
    if (!open || !showConsultantFields) {
      setTeamLeaders([]);
      return;
    }
    let cancelled = false;
    const parsed =
      departmentId.trim() !== "" ? Number(departmentId) : Number.NaN;
    const deptNum =
      Number.isFinite(parsed) && parsed >= 1 ? parsed : undefined;
    (async () => {
      try {
        const items = await listTeamLeaders(deptNum);
        if (!cancelled) {
          setTeamLeaders(items);
          setReportingLeaderId((prev) => {
            if (!prev) return prev;
            return items.some((u) => String(u.id) === prev) ? prev : "";
          });
        }
      } catch {
        if (!cancelled) setTeamLeaders([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, showConsultantFields, departmentId]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPassword("");
    setConfirmPassword("");
    if (mode === "edit" && user) {
      setEmail(user.email);
      setUsername(user.username ?? "");
      setFullName(user.full_name);
      setEmployeeId(user.employee_id ?? "");
      setNid(user.nid ?? "");
      setPhone(user.phone_number ?? "");
      setDesignation(user.designation ?? "");
      setStatus(user.status);
      setDepartmentId(user.department ? String(user.department.id) : "");
      const primary = user.roles[0];
      setRoleId(primary ? String(primary.id) : "");
      setTeamDeptId(user.team_department ? String(user.team_department.id) : "");
      setConsultantType(user.consultant_type ?? "");
      setReportingLeaderId(
        user.reporting_team_leader_id ? String(user.reporting_team_leader_id) : ""
      );
    } else {
      setEmail("");
      setUsername("");
      setFullName("");
      setEmployeeId("");
      setNid("");
      setPhone("");
      setDesignation("");
      setStatus(defaultStatus);
      setDepartmentId("");
      setRoleId("");
      setTeamDeptId("");
      setConsultantType("");
      setReportingLeaderId("");
    }
  }, [open, mode, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!roleId) {
      setError("Role is required.");
      return;
    }
    if (mode === "create") {
      if (!nid.trim()) {
        setError("NID is required.");
        return;
      }
      if (!phone.trim()) {
        setError("Phone number is required.");
        return;
      }
      if (!password || password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Password and confirm password do not match.");
        return;
      }
    }
    if (showTeamDept && !teamDeptId) {
      setError("Team department is required for this role.");
      return;
    }
    if (showConsultantFields) {
      if (!consultantType.trim()) {
        setError("Consultant type is required for this role.");
        return;
      }
      if (!reportingLeaderId) {
        setError("Reporting team leader is required for this role.");
        return;
      }
    }

    const rid = Number(roleId);
    const deptNum =
      showPrimaryDepartmentField && departmentId.trim() !== ""
        ? Number(departmentId)
        : null;
    if (
      requiresPrimaryDepartment &&
      (deptNum == null || !Number.isFinite(deptNum))
    ) {
      setError("Department is required for Team Leader and Consultant roles.");
      return;
    }

    if (mode === "edit" && user && password.trim().length > 0) {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Password and confirm password do not match.");
        return;
      }
    }

    setPending(true);
    try {
      if (mode === "create") {
        await createUser({
          email: email.trim(),
          username: username.trim(),
          full_name: fullName.trim(),
          password,
          nid: nid.trim(),
          phone_number: phone.trim(),
          employee_id: employeeId.trim() || null,
          designation: designation.trim() || null,
          role_ids: [rid],
          department_id: deptNum,
          status,
          approval_department_id: null,
          team_department_id: showTeamDept ? Number(teamDeptId) : null,
          receiving_department_id: null,
          consultant_type: showConsultantFields ? consultantType.trim() : null,
          reporting_team_leader_id: showConsultantFields
            ? Number(reportingLeaderId)
            : null,
        });
        toastSuccess("User created successfully.");
      } else if (user) {
        const payload: UserUpdatePayload = {
          username: username.trim() || undefined,
          full_name: fullName.trim(),
          role_ids: [rid],
          department_id: deptNum,
          status,
          approval_department_id: null,
          team_department_id: showTeamDept ? Number(teamDeptId) : null,
          receiving_department_id: null,
          consultant_type: showConsultantFields ? consultantType.trim() : null,
          reporting_team_leader_id: showConsultantFields
            ? Number(reportingLeaderId)
            : null,
        };
        if (nid.trim()) payload.nid = nid.trim();
        if (phone.trim()) payload.phone_number = phone.trim();
        if (employeeId.trim()) payload.employee_id = employeeId.trim();
        if (designation.trim()) payload.designation = designation.trim();
        if (password.trim().length > 0) {
          payload.password = password;
        }
        await updateUser(user.id, payload);
        toastSuccess("User updated successfully.");
      }
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      const m = getApiErrorMessage(err);
      setError(m);
      toastError(m);
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
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex max-h-[90vh] flex-col"
        >
          <DialogHeader className="border-b p-4 pb-3">
            <DialogTitle>
              {mode === "create" ? "Create user" : "Edit user"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Required: email, username, NID, phone, role, password. Department is required for Team Leader and Consultant only."
                : "Update account details and workflow mapping."}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[55vh] flex-1 px-4">
            <div className="space-y-4 py-4">
              {error ? (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              ) : null}

              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Basic information
              </p>

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

              <FormField id="username" label="Username" error={null}>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={2}
                  autoComplete="off"
                />
              </FormField>

              <FormField id="full_name" label="Full name" error={null}>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  minLength={2}
                />
              </FormField>

              <FormField id="employee_id" label="Employee ID" error={null}>
                <Input
                  id="employee_id"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                />
              </FormField>

              <FormField id="nid" label="NID" error={null}>
                <Input
                  id="nid"
                  value={nid}
                  onChange={(e) => setNid(e.target.value)}
                  required={mode === "create"}
                />
              </FormField>

              <FormField id="phone" label="Phone number" error={null}>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required={mode === "create"}
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

              {mode === "create" ? (
                <FormField id="confirm" label="Confirm password" error={null}>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </FormField>
              ) : password.trim().length > 0 ? (
                <FormField id="confirm" label="Confirm new password" error={null}>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </FormField>
              ) : null}

              <Separator />

              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Organizational information
              </p>

              <FormField id="designation" label="Designation" error={null}>
                <Input
                  id="designation"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                />
              </FormField>

              {showPrimaryDepartmentField ? (
                <div className="grid gap-2">
                  <Label htmlFor="dept">Department</Label>
                  <select
                    id="dept"
                    title="Primary department"
                    className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    required={mode === "create" && requiresPrimaryDepartment}
                  >
                    <option value="">
                      {requiresPrimaryDepartment && mode === "create"
                        ? "Select department"
                        : "None (optional)"}
                    </option>
                    {departmentOptions.map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

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

              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Role assignment
              </p>

              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  required
                >
                  <option value="">Select role</option>
                  {roles.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {showTeamDept ? (
                <div className="grid gap-2">
                  <Label htmlFor="team_dept">Team department</Label>
                  <select
                    id="team_dept"
                    title="Team department"
                    className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    value={teamDeptId}
                    onChange={(e) => setTeamDeptId(e.target.value)}
                    required={mode === "create"}
                  >
                    <option value="">Select…</option>
                    {departmentOptions.map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {showConsultantFields ? (
                <>
                  <FormField id="ctype" label="Consultant type" error={null}>
                    <Input
                      id="ctype"
                      value={consultantType}
                      onChange={(e) => setConsultantType(e.target.value)}
                      required={mode === "create"}
                    />
                  </FormField>
                  <div className="grid gap-2">
                    <Label htmlFor="tl">Reporting team leader</Label>
                    <select
                      id="tl"
                      className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      value={reportingLeaderId}
                      onChange={(e) => setReportingLeaderId(e.target.value)}
                      required={mode === "create"}
                    >
                      <option value="">Select…</option>
                      {teamLeaders.map((u) => (
                        <option key={u.id} value={String(u.id)}>
                          {`${u.full_name} (${u.email})`}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : null}
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
