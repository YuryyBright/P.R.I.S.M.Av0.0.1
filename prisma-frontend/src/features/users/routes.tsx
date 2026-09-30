import type { RouteObject } from "react-router";
import { RequirePermission } from "@/features/auth";
import { USERS_ROUTES, USER_PERMISSIONS } from "./constants/users.constants";

/** The feature hands its routes to app/router; app never needs to know its pages. */
export const usersRoutes: RouteObject[] = [
  {
    path: USERS_ROUTES.list,
    element: <RequirePermission permission={USER_PERMISSIONS.read} />,
    children: [{ index: true, lazy: async () => ({ Component: (await import("./pages/UsersPage")).default }) }],
  },
];
