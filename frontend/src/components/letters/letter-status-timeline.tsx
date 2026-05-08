"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getVisibleWorkflowColor,
  getVisibleWorkflowStatus,
  type VisibleWorkflowStatusKey,
} from "@/lib/workflow-display";
import type { AssignmentOut, LetterOut } from "@/types/letter";

const stages = [
  { key: "received_pending_approval", label: "Received & Pending Approval" },
  { key: "forwarded_to_department", label: "Forwarded to Department" },
  { key: "assigned_to_consultant", label: "Assigned to Consultant" },
  { key: "under_investigation", label: "Under Investigation" },
  { key: "solution_submitted", label: "Solution Submitted" },
  { key: "pending_final_closure", label: "Pending Final Closure" },
  { key: "officially_closed", label: "Officially Closed" },
  { key: "returned_for_correction", label: "Returned for Correction" },
  { key: "rejected", label: "Rejected" },
] as const;

function isDone(stageKey: VisibleWorkflowStatusKey, current: VisibleWorkflowStatusKey): boolean {
  const order: VisibleWorkflowStatusKey[] = [
    "received_pending_approval",
    "forwarded_to_department",
    "assigned_to_consultant",
    "under_investigation",
    "solution_submitted",
    "pending_final_closure",
    "officially_closed",
    "returned_for_correction",
    "rejected",
  ];
  return order.indexOf(current) >= order.indexOf(stageKey);
}

export function LetterStatusTimeline({
  letter,
  latestAssignment,
}: {
  letter: Pick<LetterOut, "status" | "department">;
  latestAssignment?: Pick<
    AssignmentOut,
    "work_status" | "consultant_user" | "resolution_note" | "has_solution_file"
  > | null;
}) {
  const current = getVisibleWorkflowStatus(letter, latestAssignment, {
    preferPendingFinalClosure: true,
  });
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Status timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {stages.map((stage) => {
            const done = isDone(stage.key, current.stageKey);
            const currentStage = stage.key === current.stageKey;
            return (
              <div
                key={stage.key}
                className={`rounded-md border px-3 py-2 text-sm ${
                  done ? getVisibleWorkflowColor(stage.key) : "text-slate-500"
                }`}
              >
                <div>{stage.label}</div>
                {currentStage ? (
                  <div className="text-[11px] font-medium">Current holder: {current.currentHolderLabel}</div>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
