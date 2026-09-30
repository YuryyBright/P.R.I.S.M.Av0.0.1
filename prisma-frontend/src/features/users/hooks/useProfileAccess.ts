import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "../../auth/hooks/useAuth";
import { fetchPermissionGroups, fetchRoleGroups, fetchRoles } from "../api/access";
import { buildAccess } from "../lib/buildAccess";

export function useProfileAccess() {
  const { user } = useAuth();
  const enabled = !!user;
  const roles = useQuery({ queryKey: ["roles", "list"], queryFn: fetchRoles, enabled });
  const roleGroups = useQuery({ queryKey: ["role-groups"], queryFn: fetchRoleGroups, enabled });
  const permGroups = useQuery({ queryKey: ["permission-groups"], queryFn: fetchPermissionGroups, enabled });

  const access = useMemo(
    () => (user ? buildAccess(user, roles.data ?? [], roleGroups.data ?? [], permGroups.data ?? []) : null),
    [user, roles.data, roleGroups.data, permGroups.data],
  );
  return { access, isLoading: roles.isLoading || roleGroups.isLoading || permGroups.isLoading };
}
