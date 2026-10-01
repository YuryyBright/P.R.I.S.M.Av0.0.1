import type { RouteObject } from "react-router";
import { AuthShell } from "./components/AuthShell";
import { AUTH_ROUTES } from "./constants/auth.constants";

/**
 * Auth pages available only for anonymous users.
 * AuthShell provides the shared TailAdmin-style layout.
 */
export const authGuestRoutes: RouteObject[] = [
  {
    element: <AuthShell />,
    children: [
      {
        path: AUTH_ROUTES.signIn,
        lazy: async () => ({
          Component: (await import("./pages/SignInPage")).default,
        }),
      },
      {
        path: AUTH_ROUTES.signUp,
        lazy: async () => ({
          Component: (await import("./pages/SignUpPage")).default,
        }),
      },
      {
        path: AUTH_ROUTES.forgotPassword,
        lazy: async () => ({
          Component: (await import("./pages/ForgotPasswordPage")).default,
        }),
      },
    ],
  },
];

/**
 * Auth pages available regardless of current session.
 * These are normally opened from email links.
 */
export const authOpenRoutes: RouteObject[] = [
  {
    element: <AuthShell />,
    children: [
      {
        path: AUTH_ROUTES.verifyEmail,
        lazy: async () => ({
          Component: (await import("./pages/VerifyEmailPage")).default,
        }),
      },
      {
        path: AUTH_ROUTES.resetPassword,
        lazy: async () => ({
          Component: (await import("./pages/ResetPasswordPage")).default,
        }),
      },
    ],
  },
];

/**
 * Auth pages that require an authenticated session.
 */
export const authProtectedRoutes: RouteObject[] = [
  {
    path: AUTH_ROUTES.changePassword,
    lazy: async () => ({
      Component: (await import("./pages/ChangePasswordPage")).default,
    }),
  },
];
