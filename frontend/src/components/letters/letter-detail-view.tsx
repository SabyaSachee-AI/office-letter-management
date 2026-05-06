"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { LetterAttachmentPreviewButton } from "@/components/attachments/letter-attachment-preview-button";
import { AssignConsultantDialog } from "@/components/assignments/assign-consultant-dialog";
import { ErrorBanner } from "@/components/data/error-banner";
import { ActionHistoryCard } from "@/components/letters/action-history-list";
import { LetterPriorityBadge, LetterStatusBadge } from "@/components/letters/letter-badges";
import { ClosurePanel } from "@/components/closure/closure-panel";
import { ConsultantAssignmentWork } from "@/components/consultant/consultant-assignment-work";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import {
  canAssignConsultant,
  canClosure,
  hasRole,
} from "@/lib/auth/roles";
import { basenamePath } from "@/lib/attachments";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getAssignmentTracking } from "@/lib/api/assignments";
import { getLetter, getLetterActionHistory } from "@/lib/api/letters";
import type { AssignmentOut, ClosureHistoryResponse, LetterOut } from "@/types/letter";

type LetterDetailViewProps = {
  letterId: number;
};

export function LetterDetailView({ letterId }: LetterDetailViewProps) {
  const { user: me } = useAuth();
  const [letter, setLetter] = useState<LetterOut | null>(null);
  const [history, setHistory] = useState<ClosureHistoryResponse | null>(null);
  const [assignments, setAssignments] = useState<AssignmentOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [l, h, t] = await Promise.all([
        getLetter(letterId),
        getLetterActionHistory(letterId),
        getAssignmentTracking(letterId).catch(() => null),
      ]);
      setLetter(l);
      setHistory(h);
      setAssignments(t?.assignments ?? []);
    } catch (e) {
      setLoadError(getApiErrorMessage(e));
      setLetter(null);
      setHistory(null);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [letterId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#closure") {
      document.getElementById("closure")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [letter]);

  if (loading) {
    return (
      <div className="space-y-6" aria-busy>
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 max-w-full" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (loadError || !letter || !history) {
    return (
      <div className="space-y-4">
        <ErrorBanner
          message={loadError ?? "This letter could not be loaded."}
        />
        <Link
          href="/dashboard/letters"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Back to letters
        </Link>
      </div>
    );
  }

  const activeAssignment = assignments.find((a) => a.is_active);
  const myConsultantAssignment =
    me &&
    activeAssignment &&
    activeAssignment.consultant_id === me.id &&
    hasRole(me, "Consultant")
      ? activeAssignment
      : null;

  const showAssign =
    canAssignConsultant(me) &&
    letter.status !== "closed" &&
    letter.status !== "rejected";

  return (
    <div className="space-y-6">
      <PageHeader
        title={letter.serial_no}
        description={letter.subject}
        actions={
          <Link
            href="/dashboard/letters"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Back to list
          </Link>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-2">
          {letter.memo_no?.trim() ? (
            <div className="sm:col-span-2">
              <span className="text-foreground font-medium">Memo No / স্মারক নং: </span>
              {letter.memo_no}
            </div>
          ) : null}
          <div>
            <span className="text-foreground font-medium">From: </span>
            {letter.received_from}
          </div>
          <div>
            <span className="text-foreground font-medium">Department: </span>
            {letter.department.name}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-foreground font-medium">Status: </span>
            <LetterStatusBadge status={letter.status} />
            <LetterPriorityBadge priority={letter.priority} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="text-foreground font-medium">Attachment: </span>
            <span className="font-mono text-xs break-all">
              {basenamePath(letter.pdf_path)}
            </span>
            <LetterAttachmentPreviewButton
              letterId={letter.id}
              filePathHint={letter.pdf_path}
              label="View"
            />
          </div>
        </CardContent>
      </Card>

      {showAssign ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Assignment</CardTitle>
            <div className="flex gap-2">
              {activeAssignment ? (
                <Button size="sm" variant="secondary" onClick={() => setReassignOpen(true)}>
                  Reassign
                </Button>
              ) : (
                <Button size="sm" onClick={() => setAssignOpen(true)}>
                  Assign consultant
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="text-sm">
            {assignments.length === 0 ? (
              <p className="text-muted-foreground">No assignments yet.</p>
            ) : (
              <ul className="space-y-2">
                {assignments.map((a) => (
                  <li key={a.id} className="border-muted flex flex-wrap gap-2 border-b pb-2">
                    <span>#{a.id}</span>
                    <span>Consultant user #{a.consultant_id}</span>
                    <span className={a.is_active ? "text-emerald-600" : ""}>
                      {a.is_active ? "Active" : "Inactive"}
                    </span>
                    <span className="capitalize">{a.work_status.replace(/_/g, " ")}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {myConsultantAssignment && me?.department?.id ? (
        <ConsultantAssignmentWork
          row={{
            assignment: myConsultantAssignment,
            letter_id: letter.id,
            serial_no: letter.serial_no,
            subject: letter.subject,
            received_from: letter.received_from,
            deadline_at: myConsultantAssignment.deadline_at,
          }}
          departmentId={me.department.id}
          onUpdated={() => void refresh()}
        />
      ) : null}

      {canClosure(me) && letter.status !== "closed" && letter.status !== "rejected" ? (
        <ClosurePanel letterId={letterId} onChanged={() => void refresh()} />
      ) : null}

      <ActionHistoryCard actions={history.actions} />

      <AssignConsultantDialog
        letterId={letterId}
        departmentId={letter.department.id}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        mode="assign"
        onSuccess={() => void refresh()}
      />
      <AssignConsultantDialog
        letterId={letterId}
        departmentId={letter.department.id}
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        mode="reassign"
        onSuccess={() => void refresh()}
      />
    </div>
  );
}
