import type { ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import type { PermissionCode } from "../types/permissions";

interface CanProps {
  permission?: PermissionCode;
  permissions?: readonly PermissionCode[];
  mode?: "all" | "any";
  fallback?: ReactNode;
  children: ReactNode;
}

export function Can({ permission, permissions = [], mode = "all", fallback = null, children }: CanProps) {
  const { hasPermission, hasAllPermissions, hasAnyPermission } = useAuth();
  if (permission && !hasPermission(permission)) return <>{fallback}</>;
  if (permissions.length && mode === "all" && !hasAllPermissions(permissions)) return <>{fallback}</>;
  if (permissions.length && mode === "any" && !hasAnyPermission(permissions)) return <>{fallback}</>;
  return <>{children}</>;
}
