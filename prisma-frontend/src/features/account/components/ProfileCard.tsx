import { useTranslation } from "react-i18next";
import type { SessionUser } from "@/features/auth";
import { getFullName, getInitials } from "../lib/userDisplay";

function Pill({ tone, children }: { tone: "success" | "gray" | "warning" | "brand"; children: string }) {
  const styles = {
    success: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500",
    gray: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-white/80",
    warning: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400",
    brand: "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400",
  } as const;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-theme-xs font-medium ${styles[tone]}`}>
      {children}
    </span>
  );
}

export function ProfileCard({ user }: { user: SessionUser }) {
  const { t } = useTranslation();

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-white/3">
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-brand-500 text-2xl font-semibold text-white">
          {getInitials(user)}
        </span>

        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-gray-800 dark:text-white/90">
            {getFullName(user)}
          </h2>
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">{user.email}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Pill tone={user.is_active ? "success" : "gray"}>
              {t(user.is_active ? "access.profileCard.active" : "access.profileCard.inactive")}
            </Pill>
            {user.verified !== undefined && (
              <Pill tone={user.verified ? "success" : "warning"}>
                {t(user.verified ? "access.profileCard.verified" : "access.profileCard.notVerified")}
              </Pill>
            )}
            {user.is_superuser && <Pill tone="brand">{t("access.profileCard.superuser")}</Pill>}
          </div>
        </div>
      </div>
    </section>
  );
}
