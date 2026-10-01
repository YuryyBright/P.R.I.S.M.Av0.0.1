/**
 * Backend permission names look like "users.read" / "user.update" / "self.update_profile".
 * The prefix is inconsistent (users vs user), so known aliases are merged into one group.
 */
const GROUP_ALIASES: Record<string, string> = { user: "users" };

export interface PermissionGroup {
  /** normalized group id, e.g. "users" */
  group: string;
  items: { name: string; action: string }[];
}

export function groupPermissions(permissions: readonly string[]): PermissionGroup[] {
  const map = new Map<string, PermissionGroup>();

  for (const name of [...new Set(permissions)].sort()) {
    const dot = name.indexOf(".");
    const rawGroup = dot === -1 ? "other" : name.slice(0, dot);
    const action = dot === -1 ? name : name.slice(dot + 1);
    const group = GROUP_ALIASES[rawGroup] ?? rawGroup;

    const bucket = map.get(group) ?? { group, items: [] };
    bucket.items.push({ name, action });
    map.set(group, bucket);
  }

  return [...map.values()].sort((a, b) => a.group.localeCompare(b.group));
}
