import { api } from "../../../shared/api/client";
import type { ApiResponse, Paginated } from "../../../shared/api/types";
import type { PermissionGroupFull, RoleFull, RoleGroupNode } from "../types";

// Ці довідники потребують role.read / role_group.read / permission_group.read.
// Звичайному користувачу вони можуть бути недоступні — тоді повертаємо [] і профіль
// будується з того, що вже є в /users/me (див. buildAccess).
const safe = <T,>(p: Promise<T[]>): Promise<T[]> => p.catch(() => []);

export const fetchRoles = () =>
  safe(api.get<ApiResponse<RoleFull[]>>("/roles/list").then((r) => r.data.data));

export const fetchRoleGroups = () =>
  safe(
    api
      .get<ApiResponse<Paginated<RoleGroupNode>>>("/role-groups", { params: { include_hierarchy: true, size: 100 } })
      .then((r) => r.data.data.items),
  );

export const fetchPermissionGroups = () =>
  safe(
    api
      .get<ApiResponse<Paginated<PermissionGroupFull>>>("/permission-groups", { params: { size: 100 } })
      .then((r) => r.data.data.items),
  );
