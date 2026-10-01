import { useTranslation } from "react-i18next";
import type { UserStatus } from "../types/user.types";

const STYLES: Record<UserStatus, string> = {
  active: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500",
  inactive: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-white/80",
  locked: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
  unverified: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400",
};

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-theme-xs font-medium capitalize ${STYLES[status]}`}>
      {t(`users.status.${status}`)}
    </span>
  );
}
