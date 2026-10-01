import type { SessionUser } from "@/features/auth";

export function getFullName(user: Pick<SessionUser, "first_name" | "last_name" | "email">): string {
  return (
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    user.email
  );
}

export function getInitials(user: Pick<SessionUser, "first_name" | "last_name" | "email">): string {
  const first = user.first_name?.trim()[0];
  const last = user.last_name?.trim()[0];
  const letters = (first && last ? first + last : first || user.email[0] || "?");
  return letters.toUpperCase();
}
