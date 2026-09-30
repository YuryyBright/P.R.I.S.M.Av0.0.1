import type { Dispatch } from "@reduxjs/toolkit";
import { CSRF_HEADER_NAME, API_BASE_URL } from "@/shared/config/env";
import { getCsrfToken } from "@/shared/api/csrf";
import type { ApiEnvelope } from "@/shared/types/api";
import { AUTH_PATHS } from "../constants/auth.constants";
import { authActions } from "../store/authSlice";
import type { TokenRead } from "../types/auth.types";

async function post(csrf: string | null): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (csrf) headers[CSRF_HEADER_NAME] = csrf;
  // Plain fetch, NOT baseApi: a 401 here must not recurse into another refresh.
  // No body: the refresh token comes from the HttpOnly cookie.
  return fetch(`${API_BASE_URL}${AUTH_PATHS.refresh}`, { method: "POST", credentials: "include", headers });
}

/**
 * POST /auth/new_access_token (status 201). Failure comes back as 400/401/403/404 depending
 * on why (missing cookie, not allowlisted, origin mismatch, user inactive), so any non-2xx = "signed out".
 */
export async function refreshSession(dispatch: Dispatch): Promise<boolean> {
  try {
    let res = await post(await getCsrfToken());
    if (res.status === 403 && /csrf/i.test(await res.clone().text())) {
      res = await post(await getCsrfToken(true)); // stale CSRF pair: retry once
    }
    if (!res.ok) return false;
    const body = (await res.json()) as ApiEnvelope<TokenRead>;
    const token = body.data?.access_token;
    if (!token) return false;
    dispatch(authActions.tokenReceived(token));
    return true;
  } catch {
    return false;
  }
}
