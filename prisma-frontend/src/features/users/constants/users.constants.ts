/** Paths are relative to API_BASE_URL. Router prefix "/users" is assumed. */
export const USERS_PATHS = {
  root: "/users",
  list: "/users/list",
  byCreatedAt: "/users/order_by_created_at",
  me: "/users/me",
  bulkUpdate: "/users/bulk-update",
  byId: (id: string) => `/users/${id}`,
  roles: (id: string) => `/users/${id}/roles`,
} as const;

/** Browser routes owned by this feature. */
export const USERS_ROUTES = { list: "/users" } as const;

/**
 * Permission names exactly as the backend checks them.
 * They are INCONSISTENT (users.* vs user.*): verify against seeded data.
 */
export const USER_PERMISSIONS = {
  read: "users.read", // list, order_by_created_at, GET /{id}
  create: "users.create",
  update: "users.update", // PUT /{id}, bulk-update
  delete: "users.delete",
  searchByEmail: "user.read", // GET /users?email=  (singular!)
  assignRoles: "user.update", // POST /{id}/roles  (singular!)
  updateSelf: "self.update_profile", // PUT /me
} as const;
