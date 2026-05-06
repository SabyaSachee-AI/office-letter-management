"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { getApiErrorMessage } from "@/lib/api/error-message";
import {
  addResolutionNote,
  transferAssignment,
  updateAssignmentStatus,
  uploadSolutionFile,
} from "@/lib/api/consultant";
import { fetchRoles, listUsers } from "@/lib/api/users";
import type { ConsultantAssignmentRow } from "@/types/letter";
import type { UserOut } from "@/types/user";

type ConsultantAssignmentWorkProps = {
  row: ConsultantAssignmentRow;
  departmentId: number;
  onUpdated: () => void;
};

const WORK_STATUSES = [
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
];

export function ConsultantAssignmentWork({
  row,
  departmentId,
  onUpdated,
}: ConsultantAssignmentWorkProps) {
  const aid = row.assignment.id;
  const [status, setStatus] = useState(row.assignment.work_status);
  const [statusComment, setStatusComment] = useState("");
  const [resNote, setResNote] = useState("");
  const [resComment, setResComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileComment, setFileComment] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferComment, setTransferComment] = useState("");
  const [peers, setPeers] = useState<UserOut[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus(row.assignment.work_status);
  }, [row.assignment.work_status]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const roles = await fetchRoles();
        const rid = roles.find((r) => r.name === "Consultant")?.id;
        if (!rid) return;
        const res = await listUsers({
          role_id: rid,
          department_id: departmentId,
          status: "active",
          limit: 100,
        });
        const others = res.items.filter((u) => u.id !== row.assignment.consultant_id);
        if (!cancelled) setPeers(others);
      } catch {
        if (!cancelled) setPeers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [departmentId, row.assignment.consultant_id]);

  async function submit(
    fn: () => Promise<unknown>,
    reset?: () => void
  ) {
    setErr(null);
    setBusy(true);
    try {
      await fn();
      reset?.();
      onUpdated();
    } catch (e) {
      setErr(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {row.serial_no}
          {row.memo_no?.trim() ? ` · Memo: ${row.memo_no}` : ""} — {row.subject}
        </CardTitle>
        <p className="text-muted-foreground text-xs">
          Deadline: {new Date(row.deadline_at).toLocaleString()} · Assignment #
          {aid}
        </p>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        {err ? (
          <p className="text-destructive" role="alert">
            {err}
          </p>
        ) : null}
        {row.assignment.resolution_note ? (
          <p className="bg-muted/50 rounded-md border p-2 text-xs">
            <span className="font-medium">Resolution note: </span>
            {row.assignment.resolution_note}
          </p>
        ) : null}

        <div className="space-y-2">
          <h4 className="font-medium">Update status</h4>
          <div className="flex flex-wrap gap-2">
            <select
              className="border-input h-9 rounded-md border px-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              {WORK_STATUSES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Input
              placeholder="Comment (min 2 chars)"
              value={statusComment}
              onChange={(e) => setStatusComment(e.target.value)}
              className="max-w-xs"
            />
            <Button
              size="sm"
              disabled={busy || statusComment.trim().length < 2}
              onClick={() =>
                void submit(
                  () =>
                    updateAssignmentStatus(
                      aid,
                      status,
                      statusComment.trim()
                    ),
                  () => setStatusComment("")
                )
              }
            >
              Save status
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <h4 className="font-medium">Resolution note</h4>
          <textarea
            className="border-input min-h-[72px] w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Resolution details (min 3 characters)"
            value={resNote}
            onChange={(e) => setResNote(e.target.value)}
          />
          <Input
            placeholder="Timeline comment (min 2 chars)"
            value={resComment}
            onChange={(e) => setResComment(e.target.value)}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={
              busy ||
              resNote.trim().length < 3 ||
              resComment.trim().length < 2
            }
            onClick={() =>
              void submit(
                () =>
                  addResolutionNote(
                    aid,
                    resNote.trim(),
                    resComment.trim()
                  ),
                () => {
                  setResNote("");
                  setResComment("");
                }
              )
            }
          >
            Save resolution
          </Button>
        </div>

        <Separator />

        <div className="space-y-2">
          <h4 className="font-medium">Upload solution file</h4>
          <Input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Input
            placeholder="Upload comment (min 2 chars)"
            value={fileComment}
            onChange={(e) => setFileComment(e.target.value)}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !file || fileComment.trim().length < 2}
            onClick={() => {
              if (!file) return;
              const fd = new FormData();
              fd.append("comment", fileComment.trim());
              fd.append("file", file);
              void submit(
                () => uploadSolutionFile(aid, fd),
                () => {
                  setFile(null);
                  setFileComment("");
                }
              );
            }}
          >
            Upload
          </Button>
        </div>

        <Separator />

        <div className="space-y-2">
          <h4 className="font-medium">Transfer to colleague</h4>
          <select
            className="border-input h-9 w-full max-w-md rounded-md border px-2 text-sm"
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
          >
            <option value="">Select consultant…</option>
            {peers.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.full_name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Transfer comment (min 2 chars)"
            value={transferComment}
            onChange={(e) => setTransferComment(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={
              busy ||
              !transferTo ||
              transferComment.trim().length < 2
            }
            onClick={() =>
              void submit(
                () =>
                  transferAssignment(
                    aid,
                    Number(transferTo),
                    transferComment.trim()
                  ),
                () => {
                  setTransferTo("");
                  setTransferComment("");
                }
              )
            }
          >
            Transfer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
