export interface RoleFull {
  id: string;
  name: string;
  description?: string | null;
  role_group_id?: string | null;
  permissions: { id: string; name: string; group_id?: string | null }[];
}

export interface RoleGroupNode {
  id: string;
  name: string;
  parent?: { id: string; name: string } | null;
  children?: RoleGroupNode[];
}

export interface PermissionGroupFull {
  id: string;
  name: string;
  permissions?: { id: string; name: string }[];
}

// Те, що показує сторінка профілю
export interface AccessRoleGroup {
  key: string;
  title: string; // "Батько / Група" або "Без групи"
  roles: { id: string; name: string; description?: string | null }[];
}
export interface AccessSection {
  key: string;
  title: string;
  permissions: string[];
}
export interface ProfileAccess {
  roleGroups: AccessRoleGroup[];
  sections: AccessSection[];
}
