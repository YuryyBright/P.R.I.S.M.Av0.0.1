import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../../features/auth/hooks/useAuth";

export default function ProtectedRoute() {
  const { isAuthenticated, isInitialized, isLoading } = useAuth();
  const location = useLocation();

  // Чекаємо, поки auth перевірить сесію
  if (!isInitialized || isLoading) {
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
