import { isAxiosError, type AxiosError } from "axios";

type ApiErrorBody = {
  message?: string;
  detail?: unknown;
  field_errors?: { field?: string; message?: string }[];
};

function isUnreachableNetworkError(error: AxiosError): boolean {
  if (error.response) return false;
  const code = error.code;
  const msg = (error.message || "").toLowerCase();
  return (
    code === "ERR_NETWORK" ||
    code === "ECONNREFUSED" ||
    code === "ECONNABORTED" ||
    msg.includes("network error")
  );
}

export function getApiErrorMessage(error: unknown): string {
  if (!isAxiosError(error)) {
    return error instanceof Error ? error.message : "Something went wrong";
  }
  if (isUnreachableNetworkError(error)) {
    return (
      "Cannot reach the API. Start the backend from the backend folder " +
      "(e.g. uvicorn app.main:app --reload --host 127.0.0.1 --port 8000), " +
      "confirm the database is up, and set NEXT_PUBLIC_API_URL in frontend/.env.local " +
      "to match the API URL (defaults to http://127.0.0.1:8000)."
    );
  }
  const data = error.response?.data as ApiErrorBody | undefined;
  if (data && typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }
  if (data?.field_errors?.length) {
    return data.field_errors
      .map((fe) =>
        fe.field && fe.message ? `${fe.field}: ${fe.message}` : fe.message ?? ""
      )
      .filter(Boolean)
      .join("; ");
  }
  const d = data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d
      .map((item) =>
        typeof item === "object" && item !== null && "msg" in item
          ? String((item as { msg: string }).msg)
          : JSON.stringify(item)
      )
      .join("; ");
  }
  return error.message || "Request failed";
}
