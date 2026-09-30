import axios from "axios";
import { AUTH_ENDPOINTS } from "../../../app/config/constants";
import { env } from "../../../app/config/env";
import type { ApiResponse } from "../../../shared/api/types";
import type { AccessToken } from "../types/auth";
import { getCsrfToken } from "./csrf";

export async function refreshAccessToken(): Promise<string> {
  const csrfToken = await getCsrfToken();
  const { data } = await axios.post<ApiResponse<AccessToken>>(
    `${env.apiUrl}${AUTH_ENDPOINTS.refresh}`,
    {},
    {
      withCredentials: true,
      headers: { "X-CSRFToken": csrfToken },
    },
  );
  return data.data.access_token;
}
