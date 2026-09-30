/**
 * Decouples the http layer (shared) from the auth feature.
 * shared/ must never import features/, so auth registers itself here once at startup
 * (see features/auth/setup.ts, called from app/main.tsx).
 */
export interface AuthBridge {
  getAccessToken: () => string | null;
  /** Calls the cookie-based refresh endpoint, stores the new access token, resolves true on success. */
  refresh: (() => Promise<boolean>) | null;
  /** Called when refresh failed: clear local session (the route guards then redirect to sign-in). */
  onAuthFailed: (() => void) | null;
}

let bridge: AuthBridge = { getAccessToken: () => null, refresh: null, onAuthFailed: null };

export const configureAuthBridge = (patch: Partial<AuthBridge>): void => {
  bridge = { ...bridge, ...patch };
};
export const getAuthBridge = (): AuthBridge => bridge;

let refreshing: Promise<boolean> | null = null;

/**
 * Single-flight refresh: parallel 401s (and the boot-time refresh, which React
 * StrictMode runs twice in dev) share one request.
 */
export const refreshSessionOnce = (): Promise<boolean> => {
  const { refresh } = getAuthBridge();
  if (!refresh) return Promise.resolve(false);
  refreshing ??= refresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
};
