import { Navigate, Outlet, useLocation } from "react-router";
import { useSession, useSessionBootstrap } from "@/features/auth";

export default function ProtectedRoute() {
  const isInitialized = useSessionBootstrap();
  const { isAuthenticated, isLoadingUser } = useSession();
  const location = useLocation();

  // Чекаємо, поки auth перевірить сесію
  if (!isInitialized || isLoadingUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">Завантаження...</div>
      </div>
    );
  }

  // Користувач не авторизований
  if (!isAuthenticated) {
    return (
      <Navigate to="/signup" replace state={{ from: location.pathname }} />
    );
  }

  // Авторизований
  return <Outlet />;
}
