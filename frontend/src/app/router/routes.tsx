import { RouteObject } from "react-router";
import AuthLayout from "../../layouts/AuthLayout";
import DashboardLayout from "../../layouts/DashboardLayout";
import LoginPage from "../../pages/auth/LoginPage";
import DashboardPage from "../../pages/dashboard/DashboardPage";
import ForbiddenPage from "../../pages/errors/ForbiddenPage";
import NotFoundPage from "../../pages/errors/NotFoundPage";
import ProfilePage from "../../pages/profile/ProfilePage";
import { GuestOnly, RequireAuth } from "./guards";

export const routes: RouteObject[] = [
  {
    element: <GuestOnly />,
    children: [{ element: <AuthLayout />, children: [{ path: "/login", element: <LoginPage /> }] }],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/profile", element: <ProfilePage /> },
          { path: "/403", element: <ForbiddenPage /> },
          // Нові розділи: { element: <RequirePermission perms={["users.read"]} />, children: [...] }
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
];
