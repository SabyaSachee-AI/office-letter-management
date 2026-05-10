import { api } from "@/lib/api/client";
import type {
  AnalyticsFilters,
  AnalyticsOverview,
  AnalyticsTablePaging,
  ConsultantAnalyticsOut,
  DepartmentAnalyticsOut,
  TrendsOut,
} from "@/types/analytics";

function buildParams(filters: AnalyticsFilters) {
  return {
    preset: filters.preset || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    department_id: filters.department_id ?? undefined,
  };
}

export async function fetchAnalyticsOverview(filters: AnalyticsFilters): Promise<AnalyticsOverview> {
  const { data } = await api.get<AnalyticsOverview>("/api/v1/analytics/overview", {
    params: buildParams(filters),
  });
  return data;
}

export async function fetchAnalyticsDepartments(
  filters: AnalyticsFilters,
  paging?: AnalyticsTablePaging
): Promise<DepartmentAnalyticsOut> {
  const { data } = await api.get<DepartmentAnalyticsOut>("/api/v1/analytics/departments", {
    params: {
      ...buildParams(filters),
      ...(paging
        ? {
            limit: paging.limit,
            offset: paging.offset,
            sort_by: paging.sort_by,
            sort_dir: paging.sort_dir,
          }
        : {}),
    },
  });
  return data;
}

export async function fetchAnalyticsConsultants(
  filters: AnalyticsFilters,
  paging?: AnalyticsTablePaging
): Promise<ConsultantAnalyticsOut> {
  const { data } = await api.get<ConsultantAnalyticsOut>("/api/v1/analytics/consultants", {
    params: {
      ...buildParams(filters),
      ...(paging
        ? {
            limit: paging.limit,
            offset: paging.offset,
            sort_by: paging.sort_by,
            sort_dir: paging.sort_dir,
          }
        : {}),
    },
  });
  return data;
}

export async function fetchAnalyticsTrends(filters: AnalyticsFilters): Promise<TrendsOut> {
  const { data } = await api.get<TrendsOut>("/api/v1/analytics/trends", {
    params: buildParams(filters),
  });
  return data;
}

export async function downloadAnalyticsCsv(filters: AnalyticsFilters): Promise<Blob> {
  const { data } = await api.get<Blob>("/api/v1/analytics/export.csv", {
    params: buildParams(filters),
    responseType: "blob",
  });
  return data;
}
