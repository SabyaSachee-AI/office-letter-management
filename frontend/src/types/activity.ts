export type AuditLogResolvedUser = {
  id: number;
  full_name: string;
  email: string;
};

export type AuditLogResolvedDepartment = {
  id: number;
  name: string;
  code: string;
};

export type AuditLogResolvedLetter = {
  id: number;
  serial_no: string;
  subject: string | null;
};

export type AuditLogResolvedAssignment = {
  id: number;
  letter_id: number | null;
};

export type AuditLogResolvedContext = {
  consultant?: AuditLogResolvedUser | null;
  target_consultant?: AuditLogResolvedUser | null;
  department?: AuditLogResolvedDepartment | null;
  letter?: AuditLogResolvedLetter | null;
  assignment?: AuditLogResolvedAssignment | null;
};

export type AuditLogOut = {
  id: number;
  actor_user_id: number | null;
  actor_email: string | null;
  user_name: string | null;
  role: string | null;
  module: string | null;
  action: string;
  description: string | null;
  entity_type: string | null;
  entity_id: number | null;
  old_value: string | null;
  new_value: string | null;
  resource_type: string | null;
  resource_id: number | null;
  detail_json: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  resolved?: AuditLogResolvedContext | null;
};

export type AuditLogListResponse = {
  items: AuditLogOut[];
  total: number;
  limit: number;
  offset: number;
};

export type AuditLogFilterOptions = {
  modules: string[];
  actions: string[];
};

export type ListAuditLogsParams = {
  limit?: number;
  offset?: number;
  action?: string;
  module?: string;
  user?: string;
  date_from?: string;
  date_to?: string;
};

/** Same filters as list, without pagination (export uses server cap). */
export type AuditLogExportParams = {
  action?: string;
  module?: string;
  user?: string;
  date_from?: string;
  date_to?: string;
};
