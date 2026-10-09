import { createBrowserRouter } from "react-router";
import {
  GuestOnly,
  RequireAuth,
  SessionGate,
  authGuestRoutes,
  authOpenRoutes,
  authProtectedRoutes,
} from "@/features/auth";
import { accountRoutes } from "@/features/account";
import { homeRoutes } from "@/features/home";
import { usersRoutes } from "@/features/users";
import AppLayout from "@/layout/AppLayout"; // TailAdmin shell: sidebar + header + <Outlet/>
import { FullPageLoader } from "@/shared/ui/FullPageLoader";
import { collectionsRoutes } from "@/features/collections";
import { jobsRoutes } from "@/features/jobs";
import { documentsRoutes } from "@/features/documents/routes";
import { aiRoutes } from "@/features/ai";
import { searchRoutes } from "@/features/search";
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
              ...homeRoutes,
              ...accountRoutes,
              ...authProtectedRoutes,
              ...usersRoutes,
              ...collectionsRoutes,
              ...documentsRoutes,
              ...jobsRoutes,
              ...aiRoutes,
              ...searchRoutes,
              {
                path: "/403",
                handle: { titleKey: "errors.forbidden.title" },
                lazy: async () => ({
                  Component: (await import("@/shared/ui/ForbiddenPage"))
                    .default,
                }),
              },

              {
                path: "*",
                handle: { titleKey: "errors.notFound.title" },
                lazy: async () => ({
                  Component: (await import("@/shared/ui/NotFoundPage")).default,
                }),
              },
            ],
          },
        ],
      },
    ],
  },
]);
