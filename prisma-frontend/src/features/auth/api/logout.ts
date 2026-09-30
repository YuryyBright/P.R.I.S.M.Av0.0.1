import { AUTH_ENDPOINTS } from "../../../app/config/constants";
import { api } from "../../../shared/api/client";

export async function logout(): Promise<void> {
  await api.post(AUTH_ENDPOINTS.logout).catch(() => {}); // локальний вихід не залежить від відповіді
}
