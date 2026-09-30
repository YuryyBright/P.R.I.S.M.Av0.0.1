/** API paths, relative to API_BASE_URL. The "/auth" router prefix is assumed. */
export const AUTH_PATHS = {
  login: "/auth/login",
  register: "/auth/register",
  verifyEmail: "/auth/verify-email",
  resendVerification: "/auth/resend-verification-email",
  passwordResetRequest: "/auth/password-reset/request",
  passwordResetConfirm: "/auth/password-reset/confirm", // /auth/reset_password is a near-duplicate, unused
  changePassword: "/auth/change_password",
  refresh: "/auth/new_access_token",
  logout: "/auth/logout",
  logoutAll: "/auth/logout/all",
  me: "/users/me", // the session user lives on the users router, but belongs to the session
} as const;

/** Browser routes. Verify/reset links in emails must point at these (check the backend's link builder). */
export const AUTH_ROUTES = {
  signIn: "/signin",
  signUp: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password", // ?token=
  verifyEmail: "/verify-email", // ?token=
  changePassword: "/change-password",
} as const;
