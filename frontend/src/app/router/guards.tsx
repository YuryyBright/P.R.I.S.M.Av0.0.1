import { Navigate, Outlet, useLocation } from "react-router";
import { ROUTES } from "../config/constants";
import { useAuth } from "../../features/auth/hooks/useAuth";
import type { PermissionCode } from "../../features/auth/types/permissions";

const Splash = () => <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">Завантаження…</div>;

export function RequireAuth() {
  const { isAuthenticated, isInitialized } = useAuth();
  const location = useLocation();
  if (!isInitialized) return <Splash />;
  if (!isAuthenticated) return <Navigate to={ROUTES.login} state={{ from: location.pathname }} replace />;
  return <Outlet />;
}

export function GuestOnly() {
  const { isAuthenticated, isInitialized } = useAuth();
  if (!isInitialized) return <Splash />;
  return isAuthenticated ? <Navigate to={ROUTES.dashboard} replace /> : <Outlet />;
}

export function RequirePermission({ permissions, mode = "all" }: {
  permissions: readonly PermissionCode[];
  mode?: "all" | "any";
}) {
  const { hasAllPermissions, hasAnyPermission } = useAuth();
  const allowed = mode === "all" ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
  return allowed ? <Outlet /> : <Navigate to={ROUTES.forbidden} replace />;
}
