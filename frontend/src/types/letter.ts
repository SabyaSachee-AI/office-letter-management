import type { DepartmentOut } from "@/types/user";

export type LetterPriority = "low" | "normal" | "high" | "urgent";

export type LetterStatus =
  | "received"
  | "under_review"
  | "returned_for_correction"
  | "rejected"
  | "processed"
  | "closed";

export type LetterOut = {
  id: number;
  serial_no: string;
  memo_no?: string | null;
  subject: string;
  received_from: string;
  pdf_path: string;
  priority: LetterPriority;
  status: LetterStatus;
  department: DepartmentOut | null;
  created_by: number;
  created_at: string;
  closed_at?: string | null;
  closed_by?: number | null;
  latest_assignment?: AssignmentOut | null;
};

export type LetterListResponse = {
  items: LetterOut[];
  total: number;
  limit: number;
  offset: number;
};

export type ApprovalQueueItem = {
  id: number;
  serial_no: string;
  memo_no?: string | null;
  subject: string;
  received_from: string;
  status: LetterStatus;
  priority: LetterPriority;
  department: DepartmentOut | null;
  created_at: string;
};

export type ApprovalQueueResponse = {
  items: ApprovalQueueItem[];
  total: number;
  limit: number;
  offset: number;
};

export type LetterActionHistoryItem = {
  id: number;
  action: string;
  comment: string;
  acted_by: number;
  acted_by_full_name?: string | null;
  acted_by_email?: string | null;
  acted_by_roles?: string[];
  from_department_id: number | null;
  to_department_id: number | null;
  created_at: string;
};

export type ClosureHistoryResponse = {
  letter_id: number;
  serial_no: string;
  status: string;
  actions: LetterActionHistoryItem[];
};

export type AssignmentWorkStatus =
  | "assigned"
  | "in_progress"
  | "resolved"
  | "transferred";

export type AssignmentUserBrief = {
  id: number;
  full_name: string;
  email: string;
  roles: string[];
  department: DepartmentOut | null;
};

export type AssignmentOut = {
  id: number;
  letter_id: number;
  consultant_id: number;
  assigned_by: number;
  deadline_at: string | null;
  is_active: boolean;
  work_status: AssignmentWorkStatus;
  resolution_note: string | null;
  has_solution_file?: boolean;
  latest_solution_file_uploaded_at?: string | null;
  assigned_at: string;
  updated_at: string;
  consultant_user?: AssignmentUserBrief | null;
  assigned_by_user?: AssignmentUserBrief | null;
};

export type AssignmentTrackingResponse = {
  letter_id: number;
  serial_no: string;
  subject: string;
  assignments: AssignmentOut[];
};

export type ConsultantAssignmentRow = {
  assignment: AssignmentOut;
  letter_id: number;
  serial_no: string;
  memo_no?: string | null;
  subject: string;
  received_from: string;
  deadline_at: string | null;
  letter_department?: DepartmentOut | null;
};

export type ConsultantAssignmentListResponse = {
  items: ConsultantAssignmentRow[];
  total: number;
  limit: number;
  offset: number;
};
