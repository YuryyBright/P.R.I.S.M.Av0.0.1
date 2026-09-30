import { API_BASE_URL, CSRF_PATH } from "../config/env";
import type { ApiEnvelope } from "../types/api";

let token: string | null = null;
let inflight: Promise<string | null> | null = null;

async function fetchToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${CSRF_PATH}`, { credentials: "include" });
    if (!res.ok) return null;
    const body = (await res.json()) as ApiEnvelope<{ csrf_token: string }>;
    token = body.data?.csrf_token ?? null;
    return token;
  } catch {
    return null;
  }
}

/**
 * The CSRF token is paired with an HttpOnly cookie (max_age 1h on the backend).
 * Cached in memory; pass `force` to replace it after the server rejected it.
 */
export function getCsrfToken(force = false): Promise<string | null> {
  if (token && !force) return Promise.resolve(token);
  inflight ??= fetchToken().finally(() => {
    inflight = null;
  });
  return inflight;
}

export const clearCsrfToken = (): void => {
  token = null;
};
