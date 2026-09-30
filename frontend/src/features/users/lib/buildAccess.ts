import type { User } from "../../../entities/user/types";
import type {
  AccessRoleGroup, AccessSection, PermissionGroupFull, ProfileAccess, RoleFull, RoleGroupNode,
} from "../types";

function flatten(nodes: RoleGroupNode[], acc = new Map<string, RoleGroupNode>()) {
  for (const n of nodes) {
    acc.set(n.id, n);
    if (n.children?.length) flatten(n.children, acc);
  }
  return acc;
}

/**
 * Збирає "ролі по групах" і "дозволи по розділах".
 * Розділ = PermissionGroup, якщо довідник доступний; інакше префікс імені дозволу
 * ("rag.collections.read" → "rag.collections").
 */
export function buildAccess(
  user: User,
  roles: RoleFull[],
  roleGroups: RoleGroupNode[],
  permGroups: PermissionGroupFull[],
): ProfileAccess {
  const rolesById = new Map(roles.map((r) => [r.id, r]));
  const groups = flatten(roleGroups);

  const byGroup = new Map<string, AccessRoleGroup>();
  for (const r of user.roles) {
    const gid = rolesById.get(r.id)?.role_group_id ?? null;
    const g = gid ? groups.get(gid) : undefined;
    const key = gid ?? "none";
    const title = g ? (g.parent ? `${g.parent.name} / ${g.name}` : g.name) : "Без групи";
    if (!byGroup.has(key)) byGroup.set(key, { key, title, roles: [] });
    byGroup.get(key)!.roles.push(r);
  }

  const permToSection = new Map<string, string>();
  for (const pg of permGroups) for (const p of pg.permissions ?? []) permToSection.set(p.name, pg.name);

  const sections = new Map<string, AccessSection>();
  for (const perm of user.permissions) {
    const title = permToSection.get(perm) ?? (perm.includes(".") ? perm.slice(0, perm.lastIndexOf(".")) : "other");
    if (!sections.has(title)) sections.set(title, { key: title, title, permissions: [] });
    sections.get(title)!.permissions.push(perm);
  }

  return {
    roleGroups: [...byGroup.values()].sort((a, b) => a.title.localeCompare(b.title)),
    sections: [...sections.values()].sort((a, b) => a.title.localeCompare(b.title)),
  };
}
