import type { RouteObject } from "react-router";
import { AUTH_ROUTES } from "./constants/auth.constants";

/** Shown only to anonymous visitors (GuestOnly wraps these in app/router). */
export const authGuestRoutes: RouteObject[] = [
  { path: AUTH_ROUTES.signIn, lazy: async () => ({ Component: (await import("./pages/SignInPage")).default }) },
  { path: AUTH_ROUTES.signUp, lazy: async () => ({ Component: (await import("./pages/SignUpPage")).default }) },
  {
    path: AUTH_ROUTES.forgotPassword,
    lazy: async () => ({ Component: (await import("./pages/ForgotPasswordPage")).default }),
  },
];

/** Reachable whether or not you are signed in: the target of emailed links. */
export const authOpenRoutes: RouteObject[] = [
  {
    path: AUTH_ROUTES.verifyEmail,
    lazy: async () => ({ Component: (await import("./pages/VerifyEmailPage")).default }),
  },
  {
    path: AUTH_ROUTES.resetPassword,
    lazy: async () => ({ Component: (await import("./pages/ResetPasswordPage")).default }),
  },
];

/** Needs a session (RequireAuth wraps these in app/router). */
export const authProtectedRoutes: RouteObject[] = [
  {
    path: AUTH_ROUTES.changePassword,
    lazy: async () => ({ Component: (await import("./pages/ChangePasswordPage")).default }),
  },
];
