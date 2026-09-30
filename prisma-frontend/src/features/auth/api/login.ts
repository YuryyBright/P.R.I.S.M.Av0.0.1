import { AUTH_ENDPOINTS } from "../../../app/config/constants";
import { api } from "../../../shared/api/client";
import type { User } from "../../../entities/user/types";

export interface LoginResult {
  access_token: string;
  token_type: string;
  user: User;
}

// OAuth2PasswordRequestForm => x-www-form-urlencoded, поле називається username
export async function login(email: string, password: string): Promise<LoginResult> {
  const body = new URLSearchParams({ username: email, password });
  const { data } = await api.post<LoginResult>(AUTH_ENDPOINTS.login, body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data;
}
