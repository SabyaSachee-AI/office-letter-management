import axios from "axios";

import { clearToken, getToken } from "@/lib/auth/token";

/**
 * If `NEXT_PUBLIC_API_URL` is set (non-empty), the browser calls the API directly (cross-origin; backend CORS must allow your UI origin).
 * If unset or empty, requests use the same origin as the Next.js app and `next.config.ts` rewrites `/api/v1/*` to the backend (recommended local dev).
 */
const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
const baseURL =
  configured && configured.length > 0
    ? configured.replace(/\/$/, "")
    : "";

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      clearToken();
      const path = window.location.pathname;
      if (!path.startsWith("/login")) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);
