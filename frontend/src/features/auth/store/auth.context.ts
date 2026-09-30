import { createContext } from "react";
import type { User } from "../../../entities/user/types";
import type { PermissionCode } from "../types/permissions";

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: PermissionCode) => boolean;
  hasAllPermissions: (permissions: readonly PermissionCode[]) => boolean;
  hasAnyPermission: (permissions: readonly PermissionCode[]) => boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: readonly string[]) => boolean;
  isSuperuser: () => boolean;
  can: (...permissions: PermissionCode[]) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
