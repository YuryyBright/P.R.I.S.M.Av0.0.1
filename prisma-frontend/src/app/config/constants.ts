export const AUTH_ENDPOINTS = {
  login: "/auth/access-token", // OAuth2PasswordBearer tokenUrl з deps.py
  refresh: "/auth/refresh-token", // ⚠️ перевірте шлях у вашому auth-роутері
  logout: "/auth/logout", // ⚠️ те саме
} as const;

export const ROUTES = {
  login: "/login",
  dashboard: "/",
  profile: "/profile",
  forbidden: "/403",
} as const;

export const STORAGE_KEYS = { accessToken: "prisma.access_token" } as const;
