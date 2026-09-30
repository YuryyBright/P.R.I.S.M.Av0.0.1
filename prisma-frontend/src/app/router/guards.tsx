import { Navigate, Outlet, useLocation } from "react-router";
import { ROUTES } from "../config/constants";
import { useAuth } from "../../features/auth/hooks/useAuth";

const Splash = () => <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">Завантаження…</div>;

/** Тільки для авторизованих */
export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <Splash />;
  if (!isAuthenticated) return <Navigate to={ROUTES.login} state={{ from: location.pathname }} replace />;
  return <Outlet />;
}

/** Тільки для гостей (логін) */
export function GuestOnly() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <Splash />;
  return isAuthenticated ? <Navigate to={ROUTES.dashboard} replace /> : <Outlet />;
}

/** Перевірка permission-ів: <Route element={<RequirePermission perms={["users.read"]} />}> */
export function RequirePermission({ perms }: { perms: string[] }) {
  const { can } = useAuth();
  return can(...perms) ? <Outlet /> : <Navigate to={ROUTES.forbidden} replace />;
}
