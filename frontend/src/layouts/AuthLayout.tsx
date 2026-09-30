import { Outlet } from "react-router";
import { env } from "../app/config/env";

export default function AuthLayout() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-white/[0.03]">
        <h1 className="mb-1 text-2xl font-semibold text-gray-800 dark:text-white/90">{env.appName}</h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Увійдіть, щоб продовжити</p>
        <Outlet />
      </div>
    </main>
  );
}
