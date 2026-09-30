import { Link, Outlet } from "react-router";
import { Can, LogoutButton, AUTH_ROUTES, useSession } from "@/features/auth";
import { USER_PERMISSIONS, USERS_ROUTES } from "@/features/users";

/**
 * Minimal shell. In the real project swap this for TailAdmin's AppLayout (sidebar + header)
 * and move the links into its sidebar config: this is the one file allowed to know
 * which features exist.
 */
export default function AppLayout() {
  const { user } = useSession();
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 dark:border-white/[0.05] dark:bg-white/[0.03]">
        <nav className="flex gap-5 text-sm text-gray-700 dark:text-gray-300">
          <Can permission={USER_PERMISSIONS.read}>
            <Link to={USERS_ROUTES.list}>Users</Link>
          </Can>
          <Link to={AUTH_ROUTES.changePassword}>Change password</Link>
        </nav>
        <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
          <span>{user?.email}</span>
          <LogoutButton />
          <LogoutButton everywhere />
        </div>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
