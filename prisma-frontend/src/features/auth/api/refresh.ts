import axios from "axios";
import { AUTH_ENDPOINTS } from "../../../app/config/constants";
import { env } from "../../../app/config/env";

// Окремий "голий" axios — без інтерсепторів, щоб не зациклитись.
export async function refreshAccessToken(): Promise<string> {
  const { data } = await axios.post<{ access_token: string }>(
    `${env.apiUrl}${AUTH_ENDPOINTS.refresh}`,
    {}, // refresh_token береться з HttpOnly cookie
    { withCredentials: true },
  );
  return data.access_token;
}
