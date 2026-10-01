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
import AppLayout from "@/layout/AppLayout"; // TailAdmin shell: sidebar + header + <Outlet/>
import { FullPageLoader } from "../shared/ui/FullPageLoader";
/**
 * Composition only: each feature owns its routes, this file decides WHERE they sit
 * (public / guest-only / protected). New feature = spread its routes into the right group.
 *
 * Auth pages get <AuthShell/> from the auth feature's own routes (layout route),
 * protected pages get the TailAdmin <AppLayout/> from here.
 */
export const router = createBrowserRouter([
  {
    element: <SessionGate />, // waits for the boot-time refresh, so guards never flash-redirect
    HydrateFallback: FullPageLoader,
    children: [
      { element: <GuestOnly />, children: authGuestRoutes },
      ...authOpenRoutes,
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                index: true,
                element: <Navigate to={USERS_ROUTES.list} replace />,
              },
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
