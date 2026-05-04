import { api } from "@/lib/api/client";
import type { AnalyticsOut, ReportQueryParams } from "@/types/reports";

function buildParams(p: ReportQueryParams): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (p.date_from) out.date_from = p.date_from;
  if (p.date_to) out.date_to = p.date_to;
  if (p.department_id != null) out.department_id = p.department_id;
  if (p.status) out.status = p.status;
  return out;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function filenameFromHeaders(headers: Record<string, string | undefined>): string | null {
  const cd =
    headers["content-disposition"] ?? headers["Content-Disposition"];
  if (!cd) return null;
  const m = /filename="([^"]+)"/.exec(cd);
  return m?.[1] ?? null;
}

export async function fetchReportAnalytics(
  params: ReportQueryParams
): Promise<AnalyticsOut> {
  const { data } = await api.get<AnalyticsOut>("/api/v1/reports/analytics", {
    params: buildParams(params),
  });
  return data;
}

export async function downloadLettersPdf(params: ReportQueryParams) {
  const res = await api.get<Blob>("/api/v1/reports/export/letters.pdf", {
    params: buildParams(params),
    responseType: "blob",
  });
  const name =
    filenameFromHeaders(res.headers as Record<string, string | undefined>) ??
    "letters-export.pdf";
  downloadBlob(res.data, name);
}

export async function downloadLettersXlsx(params: ReportQueryParams) {
  const res = await api.get<Blob>("/api/v1/reports/export/letters.xlsx", {
    params: buildParams(params),
    responseType: "blob",
  });
  const name =
    filenameFromHeaders(res.headers as Record<string, string | undefined>) ??
    "letters-export.xlsx";
  downloadBlob(res.data, name);
}
