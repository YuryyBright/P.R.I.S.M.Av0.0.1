// Access token is intentionally memory-only. The backend keeps the refresh token
// in an HttpOnly cookie, so JavaScript never needs to read the refresh token.
let accessToken: string | null = null;

export const tokenStorage = {
  get: (): string | null => accessToken,
  set: (token: string): void => { accessToken = token; },
  clear: (): void => { accessToken = null; },
  has: (): boolean => accessToken !== null,
};
