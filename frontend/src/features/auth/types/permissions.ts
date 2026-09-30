export const PERMISSIONS = {
  USERS_READ: "users.read",
  USERS_CREATE: "users.create",
  USERS_UPDATE: "users.update",
  USERS_DELETE: "users.delete",
  ROLES_READ: "roles.read",
  ROLES_CREATE: "roles.create",
  ROLES_UPDATE: "roles.update",
  ROLES_DELETE: "roles.delete",
  PERMISSIONS_READ: "permissions.read",
  PERMISSIONS_CREATE: "permissions.create",
  PERMISSIONS_UPDATE: "permissions.update",
  PERMISSIONS_DELETE: "permissions.delete",
  ROLE_GROUPS_READ: "role_groups.read",
  ROLE_GROUPS_CREATE: "role_groups.create",
  ROLE_GROUPS_UPDATE: "role_groups.update",
  ROLE_GROUPS_DELETE: "role_groups.delete",
  PERMISSION_GROUPS_READ: "permission_groups.read",
  PERMISSION_GROUPS_CREATE: "permission_groups.create",
  PERMISSION_GROUPS_UPDATE: "permission_groups.update",
  PERMISSION_GROUPS_DELETE: "permission_groups.delete",
  SELF_UPDATE_PROFILE: "self.update_profile",
  DASHBOARD_READ: "dashboard.read",
  RAG_COLLECTIONS_READ: "rag.collections.read",
  RAG_COLLECTIONS_CREATE: "rag.collections.create",
  RAG_COLLECTIONS_MANAGE: "rag.collections.manage",
  RAG_DOCUMENTS_READ: "rag.documents.read",
  RAG_DOCUMENTS_WRITE: "rag.documents.write",
  RAG_JOBS_READ: "rag.jobs.read",
  RAG_JOBS_CREATE: "rag.jobs.create",
  RAG_JOBS_MANAGE: "rag.jobs.manage",
} as const;

export type KnownPermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Permissions are persisted in the backend DB, therefore the frontend must also
// tolerate a permission introduced by the backend without a frontend release.
export type PermissionCode = KnownPermissionCode | (string & {});
