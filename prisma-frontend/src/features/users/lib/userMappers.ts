import { fromInputValue, toInputValue } from "@/shared/lib/date";
import type {
  User,
  UserCreatePayload,
  UserStatus,
  UserUpdatePayload,
} from "../types/user.types";

/** Form state: everything is a string/boolean, dates are datetime-local values. */
export interface UserFormValues {
  email: string;
  first_name: string;
  last_name: string;
  contact_phone: string;
  password: string;
  is_active: boolean;
  is_superuser: boolean;
  expiry_date: string;
}

export const emptyUserForm: UserFormValues = {
  email: "",
  first_name: "",
  last_name: "",
  contact_phone: "",
  password: "",
  is_active: true,
  is_superuser: false,
  expiry_date: "",
};

export const userToForm = (u: User): UserFormValues => ({
  email: u.email,
  first_name: u.first_name ?? "",
  last_name: u.last_name ?? "",
  contact_phone: u.contact_phone ?? "",
  password: "",
  is_active: u.is_active,
  is_superuser: u.is_superuser,
  expiry_date: toInputValue(u.expiry_date),
});

const orUndef = (v: string): string | undefined => (v.trim() ? v.trim() : undefined);

export const formToCreatePayload = (f: UserFormValues): UserCreatePayload => ({
  email: f.email.trim(),
  password: f.password,
  first_name: orUndef(f.first_name),
  last_name: orUndef(f.last_name),
  contact_phone: orUndef(f.contact_phone),
  is_active: f.is_active,
  is_superuser: f.is_superuser,
  expiry_date: fromInputValue(f.expiry_date) ?? undefined,
});

/**
 * Diff against the original: only changed keys go out. Backend quirk: if the
 * ONLY change is a field set to null, the route answers "No changes to update"
 * (it checks `any(value is not None)`), so clearing e.g. expiry_date alone
 * does nothing. Pair it with another change or fix the backend check.
 */
export function formToUpdatePayload(f: UserFormValues, original: User): UserUpdatePayload {
  const out: UserUpdatePayload = {};
  const email = f.email.trim();
  if (email && email !== original.email) out.email = email;

  const textFields = ["first_name", "last_name", "contact_phone"] as const;
  for (const key of textFields) {
    const next = f[key].trim();
    if (next !== (original[key] ?? "")) out[key] = next || null;
  }

  if (f.is_active !== original.is_active) out.is_active = f.is_active;
  if (f.is_superuser !== original.is_superuser) out.is_superuser = f.is_superuser;
  if (f.expiry_date !== toInputValue(original.expiry_date)) out.expiry_date = fromInputValue(f.expiry_date);
  if (f.password) out.password = f.password; // blank = leave as is
  return out;
}

export const userFullName = (u: Pick<User, "first_name" | "last_name" | "email">): string =>
  [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;

export function userStatus(u: User): UserStatus {
  if (u.is_locked) return "locked";
  if (!u.is_active) return "inactive";
  if (u.verified === false) return "unverified";
  return "active";
}
