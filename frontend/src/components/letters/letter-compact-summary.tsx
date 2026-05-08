import type { ReactNode } from "react";

import { LetterPriorityBadge, LetterStatusBadge } from "@/components/letters/letter-badges";
import { basenamePath } from "@/lib/attachments";
import { cn } from "@/lib/utils";
import type { LetterOut } from "@/types/letter";

type LetterCompactSummaryProps = {
  letter: LetterOut;
  className?: string;
  adminSection?: ReactNode;
  workflowLabel?: string;
  currentHolderLabel?: string;
  internalStatus?: string;
};

/** Compact sidebar summary — enterprise-style panel without nested card overflow issues */
export function LetterCompactSummary({
  letter,
  className,
  adminSection,
  workflowLabel,
  currentHolderLabel,
  internalStatus,
}: LetterCompactSummaryProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
        className
      )}
    >
      <h2 className="border-b border-slate-100 pb-2 text-xs font-semibold tracking-wide text-[#123f63] uppercase">
        Letter summary
      </h2>
      <dl className="mt-3 grid gap-y-1.5 text-[11px] leading-snug text-slate-700">
        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          <dt className="font-medium text-slate-600">Serial</dt>
          <dd className="text-slate-900">{letter.serial_no}</dd>
        </div>
        {letter.memo_no?.trim() ? (
          <div className="grid grid-cols-[auto_1fr] gap-x-2">
            <dt className="font-medium text-slate-600">Memo / স্মারক নং</dt>
            <dd className="break-words">{letter.memo_no}</dd>
          </div>
        ) : null}
        <div className="col-span-2">
          <dt className="font-medium text-slate-600">Subject</dt>
          <dd className="mt-0.5 text-slate-900">{letter.subject}</dd>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-2">
          <dt className="font-medium text-slate-600">From office</dt>
          <dd className="break-words">{letter.received_from}</dd>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-2">
          <dt className="font-medium text-slate-600">Received</dt>
          <dd>{new Date(letter.created_at).toLocaleString()}</dd>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-2">
          <dt className="font-medium text-slate-600">Status</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <LetterStatusBadge status={letter.status} />
            <LetterPriorityBadge priority={letter.priority} />
          </dd>
        </div>
        {workflowLabel ? (
          <div className="grid grid-cols-[auto_1fr] gap-x-2">
            <dt className="font-medium text-slate-600">Workflow state</dt>
            <dd>
              <div>{workflowLabel}</div>
              {currentHolderLabel ? (
                <div className="text-muted-foreground text-[11px]">
                  Current holder: {currentHolderLabel}
                </div>
              ) : null}
              {internalStatus ? (
                <div className="text-muted-foreground text-[10px]">Internal: {internalStatus}</div>
              ) : null}
            </dd>
          </div>
        ) : null}
        <div className="grid grid-cols-[auto_1fr] gap-x-2">
          <dt className="font-medium text-slate-600">Department</dt>
          <dd>
            {letter.department
              ? `${letter.department.name} (${letter.department.code})`
              : "Pending assignment"}
          </dd>
        </div>
        <div className="border-t border-slate-100 pt-2">
          <dt className="font-medium text-slate-600">Attachment</dt>
          <dd className="mt-0.5 break-all font-mono text-[10px] text-slate-600">
            {basenamePath(letter.pdf_path)}
          </dd>
        </div>
      </dl>
      {adminSection ? (
        <div className="mt-3 border-t border-slate-100 pt-3">{adminSection}</div>
      ) : null}
    </div>
  );
}
