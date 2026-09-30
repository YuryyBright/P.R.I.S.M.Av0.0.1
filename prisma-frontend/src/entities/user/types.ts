// Відповідає serialize_user() на бекенді
export interface UserRole {
  id: string;
  name: string;
  description?: string | null;
}

export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  verified: boolean;
  needs_to_change_password: boolean;
  contact_phone: string | null;
  last_changed_password_date: string | null;
  expiry_date: string | null;
  roles: UserRole[];
  permissions: string[];
  created_at: string;
  updated_at: string | null;
}

export const fullName = (u: Pick<User, "first_name" | "last_name" | "email">) =>
  [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;
