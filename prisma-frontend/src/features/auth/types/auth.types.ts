import type { ISODateString, UUID } from "@/shared/types/api";

/* ---------- what the backend returns (IUserRead inside Token / GET /users/me) ---------- */

export interface SessionRole {
  id: UUID;
  name: string;
  description: string | null;
}

/**
 * The signed-in user as auth sees it. The admin-facing `User` (users feature) is
 * a richer type; auth deliberately owns its own minimal one so that
 * auth never imports users. The backend serializes these flags on login and
 * GET /users/me.
 */
export interface SessionUser {
  id: UUID;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  needs_to_change_password: boolean;
  contact_phone: string | null;
  expiry_date: ISODateString | null;
  is_locked: boolean;
  verified: boolean;
  last_changed_password_date: ISODateString | null;
  number_of_failed_attempts: number | null;
  locked_until: ISODateString | null;
  created_at: ISODateString;
  updated_at: ISODateString;
  roles: SessionRole[];
  /** flat, unique permission names from all roles, e.g. "users.read" */
  permissions: string[];
}

/** Token (login, change_password). refresh_token is always null: it travels in the HttpOnly cookie. */
export interface Token {
  access_token: string;
  token_type: string;
  refresh_token: string | null;
  user: SessionUser;
}

/** TokenRead (POST /auth/new_access_token). */
export interface TokenRead {
  access_token: string;
  token_type: string;
}

/* ---------- request payloads ---------- */

/** POST /auth/login: two separate Body(...) params -> JSON object with these two keys. */
export interface LoginPayload {
  email: string;
  password: string;
}

/** UserRegister. Password policy (min 12) is enforced server-side. */
export interface RegisterPayload {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface VerifyEmailPayload {
  token: string;
}

/** PasswordResetRequest: also used by resend-verification-email. */
export interface EmailPayload {
  email: string;
}

export interface PasswordResetConfirmPayload {
  token: string;
  new_password: string;
}

/** POST /auth/change_password: two Body(...) params. */
export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}
