import type { AssignmentOut, LetterActionHistoryItem } from "@/types/letter";
import { getAssignmentWorkStatusLabel } from "@/lib/workflow-display";

/** Mirrors backend closure preconditions: resolved status, resolution text, or timeline evidence. */
export function consultantWorkReadyForClosure(
  assignments: AssignmentOut[],
  consultantSolutionSummary: string | null
): boolean {
  if ((consultantSolutionSummary ?? "").trim().length > 0) return true;
  return assignments.some(
    (a) =>
      a.work_status === "resolved" || Boolean((a.resolution_note ?? "").trim())
  );
}

export function buildConsultantSolutionSummary(
  actions: LetterActionHistoryItem[],
  assignments: AssignmentOut[]
): string | null {
  const chunks: string[] = [];
  for (const a of [...assignments].sort((x, y) => x.id - y.id)) {
    const note = (a.resolution_note ?? "").trim();
    const who = a.consultant_user?.full_name ?? `user ${a.consultant_id}`;
    if (note) {
      chunks.push(
        `Assignment #${a.id} (${who}) — work status: ${getAssignmentWorkStatusLabel(a.work_status)}:\n${note}`
      );
    }
  }
  for (const act of actions) {
    if (act.action === "resolution_note" && act.comment.trim()) {
      chunks.push(act.comment.trim());
    }
    if (act.action === "solution_file_upload" && act.comment.trim()) {
      chunks.push(`Solution file upload: ${act.comment.trim()}`);
    }
    if (act.action === "consultant_status_update" && act.comment.trim()) {
      chunks.push(`Status update (consultant): ${act.comment.trim()}`);
    }
  }
  if (!chunks.length) return null;
  return chunks.join("\n\n---\n\n");
}

export function lastTeamLeaderAssignmentAction(
  actions: LetterActionHistoryItem[]
): LetterActionHistoryItem | null {
  const tl = actions.filter(
    (a) => a.action === "assign_consultant" || a.action === "reassign_consultant"
  );
  if (!tl.length) return null;
  return tl.reduce((a, b) => (a.id > b.id ? a : b));
}
