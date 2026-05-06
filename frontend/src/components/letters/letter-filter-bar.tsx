"use client";

import { FilterSelect } from "@/components/forms/filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Option = { value: string; label: string };

type LetterFilterBarProps = {
  search: string;
  fromOffice: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  department: string;
  onSearchChange: (v: string) => void;
  onFromOfficeChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onDepartmentChange: (v: string) => void;
  onApply: () => void;
  onReset: () => void;
  statusOptions?: Option[];
  departmentOptions?: Option[];
  showDepartment?: boolean;
};

export function LetterFilterBar({
  search,
  fromOffice,
  status,
  dateFrom,
  dateTo,
  department,
  onSearchChange,
  onFromOfficeChange,
  onStatusChange,
  onDateFromChange,
  onDateToChange,
  onDepartmentChange,
  onApply,
  onReset,
  statusOptions = [],
  departmentOptions = [],
  showDepartment = false,
}: LetterFilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200/80 bg-slate-50/90 p-3 shadow-sm sm:p-4">
      <div className="grid min-w-[min(100%,16rem)] flex-1 gap-1.5 sm:min-w-[12rem]">
        <span className="text-muted-foreground text-xs font-medium">Search</span>
        <Input
          aria-label="Search letters"
          placeholder="Serial No / Memo No / Subject"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9"
        />
      </div>
      <div className="grid min-w-[min(100%,12rem)] flex-1 gap-1.5 sm:min-w-[12rem]">
        <span className="text-muted-foreground text-xs font-medium">From Office</span>
        <Input
          aria-label="From office"
          placeholder="Office name"
          value={fromOffice}
          onChange={(e) => onFromOfficeChange(e.target.value)}
          className="h-9"
        />
      </div>
      <div className="grid gap-1.5">
        <span className="text-muted-foreground text-xs font-medium">Status</span>
        <FilterSelect
          aria-label="Status"
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          options={statusOptions}
          placeholderLabel="Any status"
        />
      </div>
      <div className="grid gap-1.5">
        <span className="text-muted-foreground text-xs font-medium">From Date</span>
        <Input
          aria-label="From date"
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="h-9"
        />
      </div>
      <div className="grid gap-1.5">
        <span className="text-muted-foreground text-xs font-medium">To Date</span>
        <Input
          aria-label="To date"
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="h-9"
        />
      </div>
      {showDepartment ? (
        <div className="grid gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">Department</span>
          <FilterSelect
            aria-label="Department"
            value={department}
            onChange={(e) => onDepartmentChange(e.target.value)}
            options={departmentOptions}
            placeholderLabel="All departments"
          />
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button size="sm" type="button" onClick={onApply}>
          Apply
        </Button>
        <Button size="sm" type="button" variant="outline" onClick={onReset}>
          Reset
        </Button>
      </div>
    </div>
  );
}
