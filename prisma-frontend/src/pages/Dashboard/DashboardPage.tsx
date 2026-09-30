import { useAuth } from "../../features/auth/hooks/useAuth";
import { fullName } from "../../entities/user/types";

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Вітаємо, {user && fullName(user)}</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Тут буде огляд системи.</p>
    </div>
  );
}
