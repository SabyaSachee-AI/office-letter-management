"use client";

import Link from "next/link";

import { LetterPriorityBadge } from "@/components/letters/letter-badges";
import { buttonVariants } from "@/components/ui/button";
import { basenamePath } from "@/lib/attachments";
import { cn } from "@/lib/utils";
import type { LetterOut } from "@/types/letter";

type LetterReviewCompactHeaderProps = {
  letter: LetterOut;
  visibleLabel: string;
  currentHolderLabel: string;
  internalStatus?: string;
  showInternalStatus?: boolean;
  backHref: string;
  backLabel: string;
  className?: string;
};

const PRIORITY_LABEL: Record<LetterOut["priority"], string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export function LetterReviewCompactHeader({
  letter,
  visibleLabel,
  currentHolderLabel,
  internalStatus,
  showInternalStatus,
  backHref,
  backLabel,
  className,
}: LetterReviewCompactHeaderProps) {
  const fileName = basenamePath(letter.pdf_path);
  const deptLabel = letter.department
    ? `${letter.department.name} (${letter.department.code})`
    : "—";

  return (
    <header
      className={cn(
        "rounded-xl border border-slate-200/90 bg-white/95 px-4 py-3 shadow-sm sm:px-5 sm:py-4",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Letter</p>
          <h1 className="text-base font-semibold leading-tight text-[#123f63] sm:text-lg">
            {letter.serial_no}
          </h1>
          <p className="text-sm leading-snug text-slate-800 sm:text-[15px]">{letter.subject}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1 text-xs sm:text-[13px]">
            <span
              className="inline-flex max-w-full rounded-full border border-indigo-200/80 bg-indigo-50/90 px-2.5 py-0.5 font-medium text-indigo-950"
              title="Current workflow stage"
            >
              {visibleLabel}
            </span>
            <span className="text-muted-foreground">
              Responsible:{" "}
              <span className="font-medium text-slate-900">{currentHolderLabel}</span>
            </span>
          </div>
        </div>
        <Link href={backHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
          {backLabel}
        </Link>
      </div>

      <details className="group mt-3 border-t border-slate-100 pt-2">
        <summary className="cursor-pointer list-none text-xs font-medium text-[#123f63] hover:underline [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-1">
            More details
            <span className="text-muted-foreground font-normal">(memo, routing, attachment)</span>
          </span>
        </summary>
        <dl className="mt-3 grid gap-2 text-[12px] text-slate-700 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="font-medium text-slate-500">Memo No</dt>
            <dd className="mt-0.5">{letter.memo_no?.trim() ? letter.memo_no : "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">From office</dt>
            <dd className="mt-0.5 break-words">{letter.received_from}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Received</dt>
            <dd className="mt-0.5">{new Date(letter.created_at).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Department</dt>
            <dd className="mt-0.5">{deptLabel}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Priority</dt>
            <dd className="mt-0.5">
              <LetterPriorityBadge priority={letter.priority} />{" "}
              <span className="text-muted-foreground">({PRIORITY_LABEL[letter.priority]})</span>
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium text-slate-500">Attachment file</dt>
            <dd className="mt-0.5 break-all font-mono text-[11px] text-slate-600">{fileName}</dd>
          </div>
          {showInternalStatus && internalStatus ? (
            <div className="sm:col-span-2 border-t border-slate-100 pt-2">
              <dt className="font-medium text-slate-500">Internal status key</dt>
              <dd className="mt-0.5 font-mono text-[11px] text-slate-500">{internalStatus}</dd>
            </div>
          ) : null}
        </dl>
      </details>
    </header>
  );
}
