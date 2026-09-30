import { AUTH_ENDPOINTS } from "../../../app/config/constants";
import { api } from "../../../shared/api/client";
import type { ApiResponse } from "../../../shared/api/types";
import type { LoginResponse } from "../types/auth";
import { getCsrfToken } from "./csrf";

export async function login(email: string, password: string): Promise<LoginResponse> {
  const csrfToken = await getCsrfToken();
  const { data } = await api.post<ApiResponse<LoginResponse>>(
    AUTH_ENDPOINTS.login,
    { email, password },
    { withCredentials: true, headers: { "X-CSRFToken": csrfToken } },
  );
  return data.data;
}
