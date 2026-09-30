import { useCallback } from "react";
import { useSession } from "./useSession";

export type PermissionMode = "all" | "any";

/**
 * UX only: the backend stays the source of truth. A superuser bypasses the check
 * client-side; set `superuserBypass` false if that is not true server-side.
 */
export function usePermissions(superuserBypass = true) {
  const { user } = useSession();
  const granted = user?.permissions;
  const isSuperuser = user?.is_superuser ?? false;

  const can = useCallback(
    (required: string | readonly string[], mode: PermissionMode = "all"): boolean => {
      if (isSuperuser && superuserBypass) return true;
      const list = typeof required === "string" ? [required] : required;
      if (list.length === 0) return true;
      const have = new Set(granted ?? []);
      return mode === "all" ? list.every((p) => have.has(p)) : list.some((p) => have.has(p));
    },
    [granted, isSuperuser, superuserBypass],
  );

  return { can, isSuperuser };
}
