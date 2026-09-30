// Prefix assumed from the docstring in role.py ("/api/v1/role/..."). Confirm for users/auth.
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

/**
 * Header that fastapi-csrf-protect reads. The library default is "X-CSRF-Token";
 * deps.validate_csrf_token / CsrfSettings.header_name were not visible to me, so
 * this is overridable.
 */
export const CSRF_HEADER_NAME: string = import.meta.env.VITE_CSRF_HEADER_NAME ?? "X-CSRF-Token";

/** GET -> sets the HttpOnly `fastapi-csrf-token` cookie and returns { data: { csrf_token } }. */
export const CSRF_PATH = "/auth/csrf-token";
