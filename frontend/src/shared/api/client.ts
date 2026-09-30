import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { env } from "../../app/config/env";
import { refreshAccessToken } from "../../features/auth/api/refresh";
import { tokenStorage } from "../lib/tokenStorage";

export const api = axios.create({ baseURL: env.apiUrl, withCredentials: true });

let onSessionExpired: () => void = () => {};
export const setSessionExpiredHandler = (fn: () => void) => { onSessionExpired = fn; };

api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string> | null = null;
type Retryable = InternalAxiosRequestConfig & { _retry?: boolean };

const isAuthFailure = (error: AxiosError) => {
  if (error.response?.status === 401) return true;
  const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
  return error.response?.status === 403 && typeof detail === "string" && /token|credentials|authentication/i.test(detail);
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as Retryable | undefined;
    const isAuthCall = original?.url?.includes("/auth/");
    if (!original || original._retry || isAuthCall || !isAuthFailure(error)) throw error;

    original._retry = true;
    try {
      refreshing ??= refreshAccessToken().finally(() => { refreshing = null; });
      const token = await refreshing;
      tokenStorage.set(token);
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    } catch {
      tokenStorage.clear();
      onSessionExpired();
      throw error;
    }
  },
);
