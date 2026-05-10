import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LetterActionHistoryItem } from "@/types/letter";

const APPROVAL_ACTIONS = new Set([
  "approve",
  "reject",
  "return_for_correction",
  "route",
]);

const TEAM_LEADER_ACTIONS = new Set(["assign_consultant", "reassign_consultant"]);

const CONSULTANT_SOLUTION_ACTIONS = new Set([
  "resolution_note",
  "solution_file_upload",
  "consultant_status_update",
]);

const TRANSFER_ACTIONS = new Set(["transfer_assignment"]);

const CLOSURE_ACTIONS = new Set(["review_solution", "final_comment", "close_issue"]);

/** Human-readable workflow status for audit trail */
export function actionStatusLabel(action: string): string {
  const labels: Record<string, string> = {
    approve: "Approved — department assigned",
    reject: "Rejected",
    return_for_correction: "Returned for correction",
    route: "Routed / reassigned (department)",
    assign_consultant: "Assigned to recipient",
    reassign_consultant: "Reassigned / forwarded",
    consultant_status_update: "Consultant status update",
    resolution_note: "Solution / resolution note",
    solution_file_upload: "Solution file uploaded",
    transfer_assignment: "Transferred / forwarded (Consultant or Team Leader)",
    review_solution: "Solution reviewed (closure)",
    final_comment: "Final / closure comment",
    close_issue: "Letter closed",
    letter_created: "Letter received / created",
    letter_updated: "Letter updated (admin)",
    letter_deleted: "Letter deleted (admin)",
  };
  return labels[action] ?? action.replace(/_/g, " ");
}

function sortById(items: LetterActionHistoryItem[]) {
  return [...items].sort((a, b) => a.id - b.id);
}

function CommentBlock({
  title,
  items,
  emptyHint,
}: {
  title: string;
  items: LetterActionHistoryItem[];
  emptyHint: string;
}) {
  const sorted = sortById(items);
  return (
    <Card className="border-[#d7e6f6]/80 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-[#123f63]">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!sorted.length ? (
          <p className="text-muted-foreground text-sm">{emptyHint}</p>
        ) : (
          <ul className="space-y-4">
            {sorted.map((a) => (
              <li
                key={a.id}
                className="rounded-md border border-slate-200/90 bg-slate-50/80 p-3 text-sm"
              >
                <p className="whitespace-pre-wrap text-slate-800">{a.comment}</p>
                <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-2 gap-y-1 border-t border-slate-200/80 pt-2 text-xs">
                  <span className="font-medium text-slate-700">
                    {a.acted_by_full_name || a.acted_by_email || `User #${a.acted_by}`}
                  </span>
                  {a.acted_by_roles?.length ? (
                    <span>· {a.acted_by_roles.join(", ")}</span>
                  ) : null}
                  <span>·</span>
                  <time dateTime={a.created_at}>{new Date(a.created_at).toLocaleString()}</time>
                  <span>·</span>
                  <span className="text-[#1f6ca6]">{actionStatusLabel(a.action)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function WorkflowCommentBlocks({ actions }: { actions: LetterActionHistoryItem[] }) {
  const approval: LetterActionHistoryItem[] = [];
  const teamLeader: LetterActionHistoryItem[] = [];
  const consultant: LetterActionHistoryItem[] = [];
  const transfer: LetterActionHistoryItem[] = [];
  const closure: LetterActionHistoryItem[] = [];
  const other: LetterActionHistoryItem[] = [];

  for (const a of actions) {
    if (APPROVAL_ACTIONS.has(a.action)) approval.push(a);
    else if (TEAM_LEADER_ACTIONS.has(a.action)) teamLeader.push(a);
    else if (CONSULTANT_SOLUTION_ACTIONS.has(a.action)) consultant.push(a);
    else if (TRANSFER_ACTIONS.has(a.action)) transfer.push(a);
    else if (CLOSURE_ACTIONS.has(a.action)) closure.push(a);
    else other.push(a);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[#123f63]">Workflow comments and history</h2>
      <p className="text-muted-foreground text-sm">
        Prior notes are read-only. Use your action panel on the right to add new workflow entries.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <CommentBlock
          title="Approval Head-PEC note"
          items={approval}
          emptyHint="No approval or routing decisions recorded yet."
        />
        <CommentBlock
          title="Team Leader note"
          items={teamLeader}
          emptyHint="No team leader assignment comments yet."
        />
        <CommentBlock
          title="Consultant solution note"
          items={consultant}
          emptyHint="No consultant work notes or uploads recorded yet."
        />
        <CommentBlock
          title="Transfer history"
          items={transfer}
          emptyHint="No consultant-to-consultant transfers yet."
        />
        <div className="lg:col-span-2">
          <CommentBlock
            title="Closure note"
            items={closure}
            emptyHint="No closure workflow steps yet."
          />
        </div>
      </div>
      {other.length ? (
        <Card className="border-dashed border-slate-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Other system events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-slate-600">
              {sortById(other).map((a) => (
                <li key={a.id} className="flex flex-wrap gap-2 border-b border-slate-100 pb-2 last:border-0">
                  <span className="font-medium">{actionStatusLabel(a.action)}</span>
                  <span className="text-muted-foreground text-xs">
                    {a.acted_by_full_name || a.acted_by_email} ·{" "}
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                  <p className="w-full whitespace-pre-wrap">{a.comment}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
