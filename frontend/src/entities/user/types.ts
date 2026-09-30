import type { PermissionCode } from "../../features/auth/types/permissions";

export interface UserRole {
  id: string;
  name: string;
  description: string | null;
  role_group_id?: string | null;
}

export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  contact_phone: string | null;
  is_active: boolean;
  is_superuser: boolean;
  verified: boolean;
  needs_to_change_password: boolean;
  is_locked?: boolean;
  locked_until?: string | null;
  number_of_failed_attempts?: number;
  last_changed_password_date: string | null;
  expiry_date: string | null;
  roles: UserRole[];
  permissions: PermissionCode[];
  created_at: string;
  updated_at: string | null;
}

export const fullName = (
  u: Pick<User, "first_name" | "last_name" | "email">,
): string => [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.email;
