import { AUTH_ENDPOINTS } from "../../../app/config/constants";
import { api } from "../../../shared/api/client";
import { getCsrfToken } from "./csrf";

export async function logout(): Promise<void> {
  const csrfToken = await getCsrfToken();
  await api.post(AUTH_ENDPOINTS.logout, {}, {
    withCredentials: true,
    headers: { "X-CSRFToken": csrfToken },
  });
}

export async function logoutAll(): Promise<void> {
  const csrfToken = await getCsrfToken();
  await api.post(AUTH_ENDPOINTS.logoutAll, {}, {
    withCredentials: true,
    headers: { "X-CSRFToken": csrfToken },
  });
}
