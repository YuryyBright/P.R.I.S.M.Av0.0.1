import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { setSessionExpiredHandler } from "../../shared/api/client";
import { tokenStorage } from "../../shared/lib/tokenStorage";
import type { User } from "../../entities/user/types";
import { login as loginApi } from "../../features/auth/api/login";
import { logout as logoutApi } from "../../features/auth/api/logout";
import { fetchMe } from "../../features/users/api/me";
import { AuthContext, AuthContextValue } from "../../features/auth/store/auth.context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(() => !!tokenStorage.get());

  // Відновлення сесії при старті (інтерсептор сам оновить токен через refresh cookie)
  useEffect(() => {
    if (!tokenStorage.get()) return;
    fetchMe()
      .then(setUser)
      .catch(() => tokenStorage.clear())
      .finally(() => setLoading(false));
  }, []);

  // refresh провалився → розлогінюємо
  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginApi(email, password);
    tokenStorage.set(res.access_token);
    setUser(await fetchMe()); // повний профіль (roles + permissions)
  }, []);

  const logout = useCallback(async () => {
    await logoutApi();
    tokenStorage.clear();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => setUser(await fetchMe()), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
      refreshUser,
      can: (...perms) => !!user && (user.is_superuser || perms.every((p) => user.permissions.includes(p))),
    }),
    [user, isLoading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
