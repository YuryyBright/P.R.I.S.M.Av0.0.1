import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { setSessionExpiredHandler } from "../../shared/api/client";
import { tokenStorage } from "../../shared/lib/tokenStorage";
import type { User } from "../../entities/user/types";
import { login as loginApi } from "../../features/auth/api/login";
import { logout as logoutApi, logoutAll as logoutAllApi } from "../../features/auth/api/logout";
import { refreshAccessToken } from "../../features/auth/api/refresh";
import { fetchMe } from "../../features/users/api/me";
import { AuthContext, type AuthContextValue } from "../../features/auth/store/auth.context";
import type { PermissionCode } from "../../features/auth/types/permissions";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [isInitialized, setInitialized] = useState(false);

  const clearSession = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(clearSession);
    return () => setSessionExpiredHandler(() => {});
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const token = await refreshAccessToken();
        if (cancelled) return;
        tokenStorage.set(token);
        const currentUser = await fetchMe();
        if (!cancelled) setUser(currentUser);
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    void bootstrap();
    return () => { cancelled = true; };
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginApi(email, password);
    tokenStorage.set(result.access_token);
    setUser(result.user ?? await fetchMe());
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const logoutAll = useCallback(async () => {
    try {
      await logoutAllApi();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    setUser(await fetchMe());
  }, []);

  const hasPermission = useCallback((permission: PermissionCode) => {
    return !!user && (user.is_superuser || user.permissions.includes(permission));
  }, [user]);

  const hasAllPermissions = useCallback((permissions: readonly PermissionCode[]) => {
    return !!user && (user.is_superuser || permissions.every((permission) => user.permissions.includes(permission)));
  }, [user]);

  const hasAnyPermission = useCallback((permissions: readonly PermissionCode[]) => {
    return !!user && (user.is_superuser || permissions.some((permission) => user.permissions.includes(permission)));
  }, [user]);

  const hasRole = useCallback((role: string) => user?.roles.some((item) => item.name === role) ?? false, [user]);
  const hasAnyRole = useCallback((roles: readonly string[]) => user?.roles.some((item) => roles.includes(item.name)) ?? false, [user]);
  const isSuperuser = useCallback(() => user?.is_superuser === true, [user]);
  const can = useCallback((...permissions: PermissionCode[]) => hasAllPermissions(permissions), [hasAllPermissions]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    isInitialized,
    isAuthenticated: !!user,
    login,
    logout,
    logoutAll,
    refreshUser,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    hasRole,
    hasAnyRole,
    isSuperuser,
    can,
  }), [user, isLoading, isInitialized, login, logout, logoutAll, refreshUser, hasPermission, hasAllPermissions, hasAnyPermission, hasRole, hasAnyRole, isSuperuser, can]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
