"use client";

import { FilterSelect } from "@/components/forms/filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DepartmentOut, RoleOut } from "@/types/user";

export type UserFiltersState = {
  q: string;
  roleId: string;
  departmentId: string;
  status: string;
};

type UserFiltersBarProps = {
  value: UserFiltersState;
  onChange: (next: UserFiltersState) => void;
  onApply: () => void;
  onReset: () => void;
  roles: RoleOut[];
  departments: DepartmentOut[];
};

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
];

export function UserFiltersBar({
  value,
  onChange,
  onApply,
  onReset,
  roles,
  departments,
}: UserFiltersBarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200/80 bg-slate-50/90 p-4 shadow-sm md:flex-row md:flex-wrap md:items-end">
      <div className="grid min-w-0 flex-1 gap-1.5">
        <label className="text-muted-foreground text-xs font-medium" htmlFor="user-q">
          Search
        </label>
        <Input
          id="user-q"
          placeholder="Name or email"
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && onApply()}
        />
      </div>
      <div className="grid gap-1.5">
        <span className="text-muted-foreground text-xs font-medium">Role</span>
        <FilterSelect
          aria-label="Filter by role"
          value={value.roleId}
          onChange={(e) => onChange({ ...value, roleId: e.target.value })}
          options={roles.map((r) => ({
            value: String(r.id),
            label: r.name,
          }))}
        />
      </div>
      <div className="grid gap-1.5">
        <span className="text-muted-foreground text-xs font-medium">
          Department
        </span>
        <FilterSelect
          aria-label="Filter by department"
          value={value.departmentId}
          onChange={(e) => onChange({ ...value, departmentId: e.target.value })}
          options={departments.map((d) => ({
            value: String(d.id),
            label: d.name,
          }))}
        />
      </div>
      <div className="grid gap-1.5">
        <span className="text-muted-foreground text-xs font-medium">Status</span>
        <FilterSelect
          aria-label="Filter by status"
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value })}
          options={STATUS_OPTIONS}
          placeholderLabel="Any status"
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={onApply}>
          Apply
        </Button>
        <Button type="button" variant="outline" onClick={onReset}>
          Reset
        </Button>
      </div>
    </div>
  );
}
