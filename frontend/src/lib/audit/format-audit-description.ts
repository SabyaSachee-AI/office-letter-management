import type { AuditLogOut, AuditLogResolvedUser } from "@/types/activity";

function parseJsonObject(s: string | null): Record<string, unknown> | null {
  if (s == null || !String(s).trim()) return null;
  try {
    const v = JSON.parse(s) as unknown;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const t = String(v).trim();
  return t.length ? t : undefined;
}

function looksLikeStructuredPayload(text: string): boolean {
  const t = text.trim();
  return t.startsWith("{") || t.startsWith("[");
}

function mergeContext(r: AuditLogOut): Record<string, unknown> {
  const detail = parseJsonObject(r.detail_json);
  const newVal = parseJsonObject(r.new_value);
  const oldVal = parseJsonObject(r.old_value);
  const out: Record<string, unknown> = {};
  if (newVal) Object.assign(out, newVal);
  if (oldVal) Object.assign(out, oldVal);
  if (detail) Object.assign(out, detail);
  return out;
}

function entityRef(r: AuditLogOut): string | undefined {
  const id = r.entity_id ?? r.resource_id;
  const type = (r.entity_type || r.resource_type || "").toLowerCase();
  if (id == null) return undefined;
  if (type.includes("letter")) return `letter #${id}`;
  if (type.includes("user")) return `user #${id}`;
  if (type.includes("assignment")) return `assignment #${id}`;
  if (type.includes("role")) return `role #${id}`;
  return `record #${id}`;
}

/** Prefer rich formatting for these even when `description` is a short generic phrase. */
function preferFormattedDescription(action: string): boolean {
  return (
    action === "consultant_assigned" ||
    action === "consultant_reassigned" ||
    action === "consultant_transferred" ||
    action === "letter_approved" ||
    action === "letter_routed" ||
    action === "user_department_assigned"
  );
}

function personFromResolved(u: AuditLogResolvedUser | null | undefined): string | undefined {
  if (!u) return undefined;
  return `${u.full_name} (${u.email})`;
}

function letterPhrase(r: AuditLogOut, ctx: Record<string, unknown>): string {
  const sn = str(ctx.letter_serial_no) ?? r.resolved?.letter?.serial_no;
  const sub =
    str(ctx.letter_subject) ??
    (r.resolved?.letter?.subject != null ? String(r.resolved.letter.subject) : undefined);
  if (sn && sub) return `letter ${sn} (“${sub}”)`;
  if (sn) return `letter ${sn}`;
  if (r.resolved?.letter) {
    const L = r.resolved.letter;
    return L.subject ? `letter ${L.serial_no} (“${L.subject}”)` : `letter ${L.serial_no}`;
  }
  return "the letter";
}

function consultantPerson(r: AuditLogOut, ctx: Record<string, unknown>): string | undefined {
  const name = str(ctx.consultant_full_name);
  const email = str(ctx.consultant_email);
  if (name && email) return `${name} (${email})`;
  if (name) return name;
  return personFromResolved(r.resolved?.consultant ?? undefined);
}

function targetConsultantPerson(r: AuditLogOut, ctx: Record<string, unknown>): string | undefined {
  const name = str(ctx.target_consultant_full_name);
  const email = str(ctx.target_consultant_email);
  if (name && email) return `${name} (${email})`;
  if (name) return name;
  return personFromResolved(r.resolved?.target_consultant ?? undefined);
}

function assignmentClause(r: AuditLogOut, ctx: Record<string, unknown>): string {
  const fromCtx = str(ctx.assignment_id);
  const aid = fromCtx ?? (r.resolved?.assignment ? String(r.resolved.assignment.id) : undefined);
  if (!aid) return "";
  const serial = r.resolved?.letter?.serial_no;
  if (serial) {
    return ` Assignment #${aid} is the active workflow record for ${serial}.`;
  }
  return ` Assignment #${aid} is the active workflow record for this handoff.`;
}

function departmentPhrase(r: AuditLogOut, ctx: Record<string, unknown>): string | undefined {
  if (r.resolved?.department) {
    const d = r.resolved.department;
    return `${d.name} (${d.code})`;
  }
  const deptId = str(ctx.target_department_id) ?? str(ctx.department_id);
  return deptId ? `department #${deptId}` : undefined;
}

export function formatAuditLogDescription(r: AuditLogOut): string {
  const rawDesc = r.description?.trim() ?? "";
  if (
    rawDesc &&
    !looksLikeStructuredPayload(rawDesc) &&
    !preferFormattedDescription(r.action)
  ) {
    return rawDesc;
  }

  const ctx = mergeContext(r);
  const ref = entityRef(r);

  switch (r.action) {
    case "login_success": {
      const email = str(ctx.email);
      return email ? `Signed in successfully as ${email}.` : "Signed in successfully.";
    }
    case "login_failed": {
      const reason = str(ctx.reason);
      const attempted = str(ctx.email_attempted);
      const bits: string[] = ["Sign-in failed"];
      if (attempted) bits.push(`for ${attempted}`);
      if (reason) bits.push(`(${reason.replace(/_/g, " ")})`);
      return `${bits.join(" ")}.`;
    }
    case "user_created": {
      const email = str(ctx.email);
      return email ? `Created user account for ${email}.` : "Created a user account.";
    }
    case "user_updated": {
      const fields = ctx.fields;
      if (Array.isArray(fields) && fields.length) {
        return `Updated user profile (fields: ${fields.join(", ")}).`;
      }
      return ref ? `Updated ${ref}.` : "Updated a user profile.";
    }
    case "user_deleted":
      return ref ? `Permanently deleted ${ref}.` : "Permanently deleted a user account.";
    case "user_deactivated":
      return ref ? `Deactivated ${ref}.` : "Deactivated a user account.";
    case "user_roles_updated": {
      const ids = ctx.role_ids;
      if (Array.isArray(ids) && ids.length) {
        return `Updated roles for this user (role IDs: ${ids.join(", ")}).`;
      }
      return "Updated this user's roles.";
    }
    case "user_department_assigned": {
      const label = departmentPhrase(r, ctx);
      return label
        ? `Assigned this user to ${label}.`
        : "Assigned this user to a department.";
    }
    case "user_status_updated": {
      const st = str(ctx.status);
      return st ? `Changed user status to ${st}.` : "Updated user status.";
    }
    case "letter_received":
    case "letter_created": {
      const sn = str(ctx.serial_no);
      const sub = str(ctx.subject);
      if (sn && sub) return `Received letter ${sn}: “${sub}”.`;
      if (sn) return `Received letter ${sn}.`;
      return "Received a new letter.";
    }
    case "letter_updated": {
      const sn = str(ctx.serial_no);
      return sn ? `Updated letter ${sn} (metadata).` : "Updated letter details.";
    }
    case "letter_deleted": {
      const sn = str(ctx.serial_no);
      return sn ? `Deleted letter ${sn} (unassigned only).` : "Deleted a letter record.";
    }
    case "letter_approved": {
      const pri = str(ctx.priority);
      const deptLabel = departmentPhrase(r, ctx);
      const parts = [`Approved ${letterPhrase(r, ctx)}`];
      if (deptLabel) parts.push(`and routed it to ${deptLabel}`);
      if (pri) parts.push(`with priority ${pri}`);
      return `${parts.join(" ")}.`;
    }
    case "letter_rejected":
      return "Rejected the letter.";
    case "letter_returned_for_correction":
      return "Returned the letter to the sender for correction.";
    case "letter_routed": {
      const deptLabel = departmentPhrase(r, ctx);
      return deptLabel
        ? `Forwarded ${letterPhrase(r, ctx)} to ${deptLabel}.`
        : `Forwarded ${letterPhrase(r, ctx)} to another department.`;
    }
    case "consultant_assigned": {
      const who = consultantPerson(r, ctx);
      const letter = letterPhrase(r, ctx);
      const tail = assignmentClause(r, ctx);
      if (who) return `Assigned ${letter} to ${who}.${tail}`;
      return `Assigned ${letter} to another team member.${tail}`;
    }
    case "consultant_reassigned": {
      const who = consultantPerson(r, ctx);
      const letter = letterPhrase(r, ctx);
      const tail = assignmentClause(r, ctx);
      if (who) return `Reassigned ${letter} to ${who}.${tail}`;
      return `Reassigned ${letter} to another team member.${tail}`;
    }
    case "consultant_status_updated": {
      const ws = str(ctx.work_status);
      return ws
        ? `Consultant updated work status to ${ws.replace(/_/g, " ")}.`
        : "Consultant updated assignment status.";
    }
    case "consultant_resolution_added":
      return "Consultant added or updated the resolution note.";
    case "consultant_solution_uploaded": {
      const path = str(ctx.file_path);
      return path
        ? `Consultant uploaded a solution file (${path.split(/[/\\]/).pop() ?? "file"}).`
        : "Consultant uploaded a solution file.";
    }
    case "consultant_transferred": {
      const who = targetConsultantPerson(r, ctx);
      const letter = letterPhrase(r, ctx);
      const tail = assignmentClause(r, ctx);
      if (who) return `Transferred ${letter} to ${who}.${tail}`;
      return `Transferred ${letter} to another consultant.${tail}`;
    }
    case "closure_review_solution":
      return "Team leader reviewed the consultant’s solution.";
    case "closure_final_comment":
      return "Added a final comment before closure.";
    case "closure_close_issue":
      return "Closed the letter in the closure workflow.";
    case "export_pdf":
      return "Exported the letters report as a PDF file.";
    case "export_xlsx":
      return "Exported the letters report as an Excel file.";
    case "create_role": {
      const name = str(ctx.name);
      return name ? `Created custom role “${name}”.` : "Created a custom role.";
    }
    case "update_permissions":
      return "Saved changes to the role permission matrix.";
    case "reset_permissions":
      return "Reset all role permissions to system defaults.";
    case "notice_created":
      return "Published a new notice on the notice board.";
    case "notice_updated":
      return "Updated a notice on the notice board.";
    case "notice_deleted":
      return "Removed a notice from the notice board.";
    default:
      break;
  }

  if (rawDesc) return rawDesc;

  const fallback = ref
    ? `${toFriendlyAction(r.action)} (${ref}).`
    : `${toFriendlyAction(r.action)}.`;
  return fallback;
}

function toFriendlyAction(action: string): string {
  return action
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}
