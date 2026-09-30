export const AUTH_ENDPOINTS = {
  login: "/auth/login",
  refresh: "/auth/new_access_token",
  logout: "/auth/logout",
  logoutAll: "/auth/logout/all",
  csrf: "/auth/csrf-token",
} as const;

export const USER_ENDPOINTS = {
  me: "/users/me",
} as const;

export const ROUTES = {
  login: "/login",
  dashboard: "/",
  profile: "/profile",
  forbidden: "/403",
} as const;
