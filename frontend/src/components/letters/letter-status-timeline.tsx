"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LetterStatus } from "@/types/letter";

const stages = [
  { key: "received", label: "Received" },
  { key: "processed", label: "Assigned" },
  { key: "under_review", label: "Consultant Working" },
  { key: "returned_for_correction", label: "Under Review" },
  { key: "rejected", label: "Resolved" },
  { key: "closed", label: "Closed" },
] as const;

function isDone(stageKey: string, status: LetterStatus): boolean {
  const order: LetterStatus[] = [
    "received",
    "processed",
    "under_review",
    "returned_for_correction",
    "rejected",
    "closed",
  ];
  return order.indexOf(status) >= order.indexOf(stageKey as LetterStatus);
}

export function LetterStatusTimeline({ status }: { status: LetterStatus }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Status timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {stages.map((stage) => {
            const done = isDone(stage.key, status);
            return (
              <div
                key={stage.key}
                className={`rounded-md border px-3 py-2 text-sm ${
                  done ? "border-[#1f6ca6] bg-[#eef6ff] text-[#123f63]" : "text-slate-500"
                }`}
              >
                {stage.label}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
