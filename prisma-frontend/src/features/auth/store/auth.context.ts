import { createContext } from "react";
import type { User } from "../../../entities/user/types";
import type { PermissionCode } from "../types";

export interface AuthContextValue {
  // =========================
  // State
  // =========================

  user: User | null;

  isAuthenticated: boolean;

  isLoading: boolean;

  isInitialized: boolean;

  // =========================
  // Authentication
  // =========================

  login(email: string, password: string): Promise<void>;

  logout(): Promise<void>;

  logoutAll(): Promise<void>;

  refreshUser(): Promise<void>;

  // =========================
  // Permissions
  // =========================

  hasPermission(permission: PermissionCode): boolean;

  hasAllPermissions(permissions: readonly PermissionCode[]): boolean;

  hasAnyPermission(permissions: readonly PermissionCode[]): boolean;

  // =========================
  // Roles
  // =========================

  hasRole(role: string): boolean;

  hasAnyRole(roles: readonly string[]): boolean;

  // =========================
  // Superuser
  // =========================

  isSuperuser(): boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
