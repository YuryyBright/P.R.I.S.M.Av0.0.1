import { Navigate, createBrowserRouter } from "react-router";
import {
  GuestOnly,
  RequireAuth,
  SessionGate,
  authGuestRoutes,
  authOpenRoutes,
  authProtectedRoutes,
} from "@/features/auth";
import { USERS_ROUTES, usersRoutes } from "@/features/users";
import AppLayout from "./layout/AppLayout";

/**
 * Composition only: each feature owns its routes, this file decides WHERE they sit
 * (public / guest-only / protected). New feature = spread its routes into the right group.
 */
export const router = createBrowserRouter([
  {
    element: <SessionGate />, // waits for the boot-time refresh, so guards never flash-redirect
    children: [
      { element: <GuestOnly />, children: authGuestRoutes },
      ...authOpenRoutes,
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <Navigate to={USERS_ROUTES.list} replace /> },
              ...authProtectedRoutes,
              ...usersRoutes,
            ],
          },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
