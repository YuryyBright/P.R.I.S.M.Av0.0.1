import { Navigate, Outlet, useLocation } from "react-router";
import ForbiddenPage from "@/shared/ui/ForbiddenPage";
import { FullPageLoader } from "@/shared/ui/FullPageLoader";
import { AUTH_ROUTES } from "../constants/auth.constants";
import { usePermissions, type PermissionMode } from "../hooks/usePermissions";
import { useSessionBootstrap } from "../hooks/useSessionBootstrap";
import { useSession } from "../hooks/useSession";
import RouteTitle from "@/app/RouteTitle";

/** Root of the route tree: nothing renders until the boot-time refresh has settled. */
export function SessionGate() {
  const ready = useSessionBootstrap();
  return ready ? <><RouteTitle /><Outlet /></> : <FullPageLoader />;
}

/** Protected area. Redirects anonymous visitors to sign-in and remembers where they wanted to go. */
export function RequireAuth() {
  const { isAuthenticated, user, isLoadingUser } = useSession();
  const location = useLocation();

  if (!isAuthenticated)
    return (
      <Navigate to={AUTH_ROUTES.signIn} state={{ from: location }} replace />
    );
  if (isLoadingUser || !user) return <FullPageLoader />;

  // UX only (the server does not enforce it on other routes): admin-created accounts must pick their own password.
  if (
    user.needs_to_change_password &&
    location.pathname !== AUTH_ROUTES.changePassword
  ) {
    return <Navigate to={AUTH_ROUTES.changePassword} replace />;
  }
  return <Outlet />;
}

/** Sign-in / sign-up pages: a signed-in user has no business there. */
export function GuestOnly() {
  const { isAuthenticated } = useSession();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname: string } } | null)?.from
      ?.pathname ?? "/";
  return isAuthenticated ? <Navigate to={from} replace /> : <Outlet />;
}

interface RequirePermissionProps {
  permission: string | readonly string[];
  mode?: PermissionMode;
}

/** Layout route: <Outlet/> only when the current user holds the permission. */
export function RequirePermission({
  permission,
  mode,
}: RequirePermissionProps) {
  const { can } = usePermissions();
  return can(permission, mode) ? <Outlet /> : <ForbiddenPage />;
}
