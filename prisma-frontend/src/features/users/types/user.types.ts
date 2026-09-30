import type { ISODateString, UUID } from "@/shared/types/api";

/* =====================================================================
 * RESPONSE TYPES  (what serialize_user() in user_utils.py produces)
 * The route's return annotation is IGetResponseBase[IUserRead], so FastAPI
 * may drop keys that UserBase/IUserRead don't declare. Fields marked `?`
 * are the ones I can't confirm without user_model.py -> check Network tab.
 * ===================================================================== */

/** Result of _ref(): {id, name} | null. */
export interface EntityRef {
  id: UUID;
  name: string;
}

/** Permission nested in a user's role. NOTE: serialize_user does NOT include `id`. */
export interface UserRolePermission {
  name: string;
  description: string | null;
  group: EntityRef | null;
}

export interface UserRole {
  id: UUID;
  name: string;
  description: string | null;
  role_group: EntityRef | null;
  permissions: UserRolePermission[];
}

export interface User {
  id: UUID;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  needs_to_change_password: boolean;
  contact_phone: string | null;
  expiry_date: ISODateString | null;
  last_changed_password_date?: ISODateString | null;
  number_of_failed_attempts?: number | null;
  is_locked?: boolean;
  locked_until?: ISODateString | null;
  verified?: boolean;
  /** Full role objects (IUserRead.roles: list[dict]). */
  roles: UserRole[];
  /** Flat, sorted, unique permission names across all roles. e.g. ["users.read", ...] */
  permissions: string[];
  created_at?: ISODateString;
  updated_at?: ISODateString | null;
}

/* =====================================================================
 * REQUEST PAYLOADS
 * ===================================================================== */

/**
 * POST /users  (IUserCreate). Server overwrites `verified` and
 * `needs_to_change_password` from settings, so don't send them.
 * Password policy (min length 12 etc.) is enforced server-side -> 4xx message.
 */
export interface UserCreatePayload {
  email: string;
  password: string;
  first_name?: string | null;
  last_name?: string | null;
  contact_phone?: string | null;
  is_active?: boolean;
  is_superuser?: boolean;
  expiry_date?: ISODateString | null;
  /** list[UUID] of role ids. Whether create_with_role uses it is unconfirmed; prefer assignUserRoles after create. */
  role_id?: UUID[] | null;
}

/**
 * PUT /users/{id}  (IUserUpdate with @optional -> every key optional).
 * Omit `password` to leave it unchanged. Send only changed fields.
 */
export interface UserUpdatePayload {
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  contact_phone?: string | null;
  is_active?: boolean;
  is_superuser?: boolean;
  expiry_date?: ISODateString | null;
  role_id?: UUID[] | null;
  password?: string;
}

/** PUT /users/me — only these are safe: the handler's blacklist misses the rest. */
export type UserProfileUpdatePayload = Pick<UserUpdatePayload, "first_name" | "last_name" | "contact_phone">;

/** PUT /users/bulk-update — `password` is rejected with 400. */
export interface UserBulkUpdatePayload {
  user_ids: UUID[];
  updates: Omit<UserUpdatePayload, "password" | "email">;
}

/** POST /users/{user_id}/roles — IUserRoleAssign. `user_id` MUST be in the body too. */
export interface UserRolesAssignPayload {
  user_id: UUID;
  role_ids: UUID[];
}

/* =====================================================================
 * QUERY / UI TYPES
 * ===================================================================== */

/** default -> GET /users/list ; created_at -> GET /users/order_by_created_at */
export type UserOrderBy = "default" | "created_at";

export interface UsersPageArgs {
  page?: number;
  size?: number;
  orderBy?: UserOrderBy;
}

export type UserStatus = "active" | "inactive" | "locked" | "unverified";
