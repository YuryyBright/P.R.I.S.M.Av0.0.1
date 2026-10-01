import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { GroupIcon, SettingsAltIcon, UserCircleIcon } from "@/icons";
import { ACCOUNT_ROUTES } from "@/features/account";
import { usePermissions, useSession } from "@/features/auth";
import { USER_PERMISSIONS, USERS_ROUTES } from "@/features/users";

interface QuickLink {
  key: "profile" | "settings" | "users";
  to: string;
  icon: ReactNode;
  permission?: string;
}

const QUICK_LINKS: QuickLink[] = [
  { key: "profile", to: ACCOUNT_ROUTES.profile, icon: <UserCircleIcon fontSize={24} /> },
  { key: "settings", to: ACCOUNT_ROUTES.settings, icon: <SettingsAltIcon fontSize={24} /> },
  { key: "users", to: USERS_ROUTES.list, icon: <GroupIcon fontSize={24} />, permission: USER_PERMISSIONS.read },
];

const card =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={card}>
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
}

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const { user } = useSession();
  const { can } = usePermissions();

  const name = user?.first_name || user?.email.split("@")[0] || "";
  const today = new Intl.DateTimeFormat(i18n.language, { dateStyle: "full" }).format(new Date());
  const links = QUICK_LINKS.filter((l) => !l.permission || can(l.permission));

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-linear-to-br from-brand-500 to-brand-700 p-6 text-white lg:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-white/10 blur-2xl"
        />
        <p className="text-theme-sm text-white/70 first-letter:uppercase">{today}</p>
        <h1 className="mt-2 text-title-sm font-semibold sm:text-4xl">{t("home.title")}</h1>
        <p className="mt-3 text-lg text-white/90">{t("home.greeting", { name })}</p>
        <p className="mt-1 max-w-xl text-theme-sm text-white/70">{t("home.subtitle")}</p>
      </section>

      {/* Quick facts from the session */}
      {user && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label={t("home.stats.status")}
            value={t(user.is_active ? "home.stats.active" : "home.stats.inactive")}
          />
          <Stat label={t("home.stats.roles")} value={user.roles.length} />
          <Stat label={t("home.stats.permissions")} value={user.permissions.length} />
          <Stat
            label={t("home.stats.accessLevel")}
            value={t(user.is_superuser ? "home.stats.superuser" : "home.stats.regular")}
          />
        </section>
      )}

      {/* Quick access */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-gray-800 dark:text-white/90">
          {t("home.quickLinks.title")}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {links.map((link) => (
            <Link
              key={link.key}
              to={link.to}
              className={`${card} group flex items-start gap-4 transition-colors hover:border-brand-300 hover:bg-brand-25 dark:hover:border-brand-500/40 dark:hover:bg-white/5`}
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                {link.icon}
              </span>
              <span>
                <span className="block font-medium text-gray-800 dark:text-white/90">
                  {t(`home.quickLinks.${link.key}`)}
                </span>
                <span className="mt-0.5 block text-theme-sm text-gray-500 dark:text-gray-400">
                  {t(`home.quickLinks.${link.key}Hint`)}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Placeholder for the future dashboard */}
      <section className="rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">
          {t("home.placeholder.title")}
        </h2>
        <p className="mx-auto mt-1 max-w-md text-theme-sm text-gray-500 dark:text-gray-400">
          {t("home.placeholder.description")}
        </p>
      </section>
    </div>
  );
}
