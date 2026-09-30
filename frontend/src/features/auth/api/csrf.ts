import { AUTH_ENDPOINTS } from "../../../app/config/constants";
import { api } from "../../../shared/api/client";
import type { ApiResponse } from "../../../shared/api/types";

interface CsrfResponse {
  csrf_token: string;
}

let csrfToken: string | null = null;

export async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  const { data } = await api.get<ApiResponse<CsrfResponse>>(AUTH_ENDPOINTS.csrf, {
    withCredentials: true,
  });
  csrfToken = data.data.csrf_token;
  return csrfToken;
}

export function clearCsrfToken(): void {
  csrfToken = null;
}
