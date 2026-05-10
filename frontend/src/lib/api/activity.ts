import { api } from "@/lib/api/client";
import type {
  AuditLogExportParams,
  AuditLogFilterOptions,
  AuditLogListResponse,
  ListAuditLogsParams,
} from "@/types/activity";

export async function listAuditLogs(
  params: ListAuditLogsParams
): Promise<AuditLogListResponse> {
  const { data } = await api.get<AuditLogListResponse>("/api/v1/activity/audit-logs", {
    params: {
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
      action: params.action || undefined,
      module: params.module || undefined,
      user: params.user || undefined,
      date_from: params.date_from || undefined,
      date_to: params.date_to || undefined,
    },
  });
  return data;
}

export async function getAuditLogFilterOptions(): Promise<AuditLogFilterOptions> {
  const { data } = await api.get<AuditLogFilterOptions>("/api/v1/activity/audit-logs/filter-options");
  return data;
}

export async function downloadAuditLogsCsv(params: AuditLogExportParams): Promise<Blob> {
  const { data } = await api.get<Blob>("/api/v1/activity/audit-logs/export.csv", {
    params: {
      action: params.action || undefined,
      module: params.module || undefined,
      user: params.user || undefined,
      date_from: params.date_from || undefined,
      date_to: params.date_to || undefined,
    },
    responseType: "blob",
  });
  return data;
}
