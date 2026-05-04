"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export type DataTableColumn<T> = {
  id: string;
  header: string;
  className?: string;
  cell: (row: T) => React.ReactNode;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowKey: (row: T) => string | number;
  isLoading?: boolean;
  emptyContent?: React.ReactNode;
  className?: string;
};

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  isLoading,
  emptyContent,
  className,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="bg-muted/20 w-full overflow-x-auto rounded-lg border border-slate-200/80 p-4 shadow-sm">
        <div className="space-y-2">
          <Skeleton className="h-8 w-full min-w-[280px]" />
          <Skeleton className="h-8 w-full min-w-[280px]" />
          <Skeleton className="h-8 w-full min-w-[280px]" />
        </div>
      </div>
    );
  }

  if (data.length === 0 && emptyContent) {
    return <div className={className}>{emptyContent}</div>;
  }

  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-lg border border-slate-200/80 shadow-sm",
        className
      )}
    >
      <Table>
        <TableHeader className="bg-slate-100/90 [&_tr]:border-slate-200">
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.id}
                className={cn(
                  "text-[#123f63] h-11 font-semibold whitespace-nowrap",
                  col.className
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={getRowKey(row)}>
              {columns.map((col) => (
                <TableCell key={col.id} className={col.className}>
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
