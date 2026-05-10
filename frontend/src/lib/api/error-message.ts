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
    code === "ECONNRESET" ||
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    msg.includes("network error") ||
    msg.includes("socket hang up")
  );
}

function unreachableMessage(): string {
  return (
    "Cannot reach the API. Start one backend only (e.g. from office-letter-management/backend: " +
    "uvicorn app.main:app --reload --host 127.0.0.1 --port 8000), confirm the database is up, then restart `npm run dev`. " +
    "If you already had uvicorn running, stop every duplicate process on port 8000 (two servers on the same port often cause “socket hang up” during login). " +
    "By default the UI proxies /api/v1 to API_PROXY_TARGET in frontend/.env.local (http://127.0.0.1:8000). " +
    "If you set NEXT_PUBLIC_API_URL, it must match a reachable URL and CORS must allow this site’s origin."
  );
}

/** Extract user-facing text from a parsed API JSON body (FastAPI / app envelope). */
export function messageFromApiBody(data: ApiErrorBody | undefined): string | null {
  if (!data) return null;
  if (typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }
  if (data.field_errors?.length) {
    const joined = data.field_errors
      .map((fe) =>
        fe.field && fe.message ? `${fe.field}: ${fe.message}` : fe.message ?? ""
      )
      .filter(Boolean)
      .join("; ");
    return joined || null;
  }
  const d = data.detail;
  if (typeof d === "string" && d.trim()) return d;
  if (Array.isArray(d)) {
    return (
      d
        .map((item) =>
          typeof item === "object" && item !== null && "msg" in item
            ? String((item as { msg: string }).msg)
            : JSON.stringify(item)
        )
        .join("; ") || null
    );
  }
  return null;
}

function fallbackMessageForStatus(status: number | undefined): string | null {
  if (status === 401) return "Your session expired. Sign in again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "The requested resource was not found.";
  if (status === 503)
    return "Service temporarily unavailable (database or migrations may be required).";
  return null;
}

/** Resolved URL the browser tried to call (helps debug 404 / proxy / wrong API host). */
function tryResolveRequestUrl(error: AxiosError): string | null {
  const c = error.config;
  if (!c?.url) return null;
  try {
    const base =
      (c.baseURL && c.baseURL.trim().length > 0 ? c.baseURL : undefined) ??
      (typeof window !== "undefined" ? window.location.origin : "http://localhost");
    return new URL(c.url, base).href;
  } catch {
    return c.url;
  }
}

function notFoundHint(error: AxiosError): string {
  const href = tryResolveRequestUrl(error);
  const tail =
    " Start the API from the office-letter-management/backend folder (e.g. uvicorn app.main:app --reload --host 127.0.0.1 --port 8000), restart npm run dev, and check frontend/.env.local API_PROXY_TARGET or NEXT_PUBLIC_API_URL.";
  return href ? ` Request URL: ${href}.${tail}` : tail;
}

async function messageFromErrorResponseBlob(blob: Blob): Promise<string | null> {
  try {
    const text = await blob.text();
    const trimmed = text.trim();
    if (!trimmed.startsWith("{")) return null;
    const parsed = JSON.parse(trimmed) as ApiErrorBody;
    return messageFromApiBody(parsed);
  } catch {
    return null;
  }
}

export function getApiErrorMessage(error: unknown): string {
  if (!isAxiosError(error)) {
    return error instanceof Error ? error.message : "Something went wrong";
  }
  if (isUnreachableNetworkError(error)) {
    return unreachableMessage();
  }
  const raw = error.response?.data;
  if (raw instanceof Blob) {
    const statusHint = fallbackMessageForStatus(error.response?.status);
    return statusHint ?? (error.message || "Request failed");
  }
  const msg = messageFromApiBody(raw as ApiErrorBody | undefined);
  const out = msg ?? fallbackMessageForStatus(error.response?.status) ?? error.message ?? "Request failed";
  if (error.response?.status === 404) {
    return `${out}${notFoundHint(error)}`;
  }
  return out;
}

/**
 * Like {@link getApiErrorMessage}, but resolves JSON error bodies when axios used
 * `responseType: "blob"` (failed responses are often a JSON Blob, not a parsed object).
 */
export async function getApiErrorMessageAsync(error: unknown): Promise<string> {
  if (!isAxiosError(error)) {
    return error instanceof Error ? error.message : "Something went wrong";
  }
  if (isUnreachableNetworkError(error)) {
    return unreachableMessage();
  }
  const raw = error.response?.data;
  const status = error.response?.status;
  if (raw instanceof Blob) {
    const fromJson = await messageFromErrorResponseBlob(raw);
    if (fromJson) return fromJson;
    const statusHint = fallbackMessageForStatus(status);
    if (statusHint) return statusHint;
    return error.message || "Request failed";
  }
  return getApiErrorMessage(error);
}

