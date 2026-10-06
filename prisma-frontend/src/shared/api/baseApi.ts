import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, CSRF_HEADER_NAME } from "../config/env";
import { getAuthBridge, refreshSessionOnce } from "./authBridge";
import { getCsrfToken } from "./csrf";
import { normalizeError, type NormalizedApiError } from "./normalizeError";

/** Per-endpoint switch: `extraOptions: { public: true }`. */
export interface ApiExtraOptions {
  /** Endpoint takes no Bearer token (login, register...). A 401 there must NOT trigger a refresh. */
  public?: boolean;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const methodOf = (arg: string | FetchArgs): string =>
  (typeof arg === "string" ? "GET" : (arg.method ?? "GET")).toUpperCase();

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: "include", // refresh + csrf cookies are HttpOnly
  prepareHeaders: async (headers, { arg }) => {
    const accessToken = getAuthBridge().getAccessToken();
    if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
    // Every state-changing auth.py route depends on validate_csrf_token.
    if (!SAFE_METHODS.has(methodOf(arg))) {
      const csrf = await getCsrfToken();
      if (csrf) headers.set(CSRF_HEADER_NAME, csrf);
    }
    return headers;
  },
});

const isCsrfFailure = (error: FetchBaseQueryError): boolean =>
  error.status === 403 &&
  /csrf/i.test(JSON.stringify("data" in error ? error.data : ""));

export const baseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  NormalizedApiError,
  ApiExtraOptions
> = async (args, api, extra) => {
  let result = await rawBaseQuery(args, api, extra);

  // Stale CSRF token (its cookie lives 1h): fetch a fresh pair and retry once.
  if (
    result.error &&
    !SAFE_METHODS.has(methodOf(args)) &&
    isCsrfFailure(result.error)
  ) {
    await getCsrfToken(true);
    result = await rawBaseQuery(args, api, extra);
  }

  if (result.error?.status === 401 && !extra?.public) {
    if (await refreshSessionOnce())
      result = await rawBaseQuery(args, api, extra);
    else getAuthBridge().onAuthFailed?.();
  }

  return result.error
    ? { error: normalizeError(result.error) }
    : { data: result.data };
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: [
    "User",
    "Session",
    "Permission",
    "PermissionGroup",
    "Role",
    "RoleGroup",
    "Collection",
    "CollectionMember",
    "Job",

    "AiConversation",
    "AiMessages",
    "AiCapabilities",
    "AiProfile",
    "AiTask",
    "AiArtifact",
  ],

  endpoints: () => ({}),
});
