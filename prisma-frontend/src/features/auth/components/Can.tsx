import type { ReactNode } from "react";
import { usePermissions, type PermissionMode } from "../hooks/usePermissions";

interface Props {
  permission: string | readonly string[];
  mode?: PermissionMode;
  fallback?: ReactNode;
  children: ReactNode;
}

/** <Can permission="users.create"><Button/></Can> */
export function Can({ permission, mode, fallback = null, children }: Props) {
  const { can } = usePermissions();
  return <>{can(permission, mode) ? children : fallback}</>;
}
