import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SessionUser } from "@/features/auth";
import { Alert } from "@/shared/ui/Alert";
import { inputClass } from "@/shared/ui/classes";
import { groupPermissions } from "../lib/groupPermissions";

const card =
  "rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-white/3";

export function AccessOverview({ user }: { user: SessionUser }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = groupPermissions(user.permissions);
    if (!q) return all;
    return all
      .map((g) => ({ ...g, items: g.items.filter((i) => i.name.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [user.permissions, query]);

  const groupLabel = (group: string) => t(`access.groups.${group}`, { defaultValue: group });
  const actionLabel = (action: string) => t(`access.actions.${action}`, { defaultValue: action });

  return (
    <div className="space-y-6">
      {user.is_superuser && <Alert variant="info">{t("access.superuserNote")}</Alert>}

      {/* Roles */}
      <section className={card}>
        <h3 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90">
          {t("access.roles.title")}{" "}
          <span className="font-normal text-gray-400">({user.roles.length})</span>
        </h3>

        {user.roles.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("access.roles.empty")}</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {user.roles.map((role) => (
              <li
                key={role.id}
                className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
              >
                <p className="font-medium text-gray-800 dark:text-white/90">{role.name}</p>
                <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
                  {role.description || t("access.roles.noDescription")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Permissions */}
      <section className={card}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            {t("access.permissions.title")}{" "}
            <span className="font-normal text-gray-400">
              ({t("access.permissions.count", { count: user.permissions.length })})
            </span>
          </h3>
          {user.permissions.length > 0 && (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("access.permissions.search")}
              className={`${inputClass} sm:max-w-xs`}
            />
          )}
        </div>

        {user.permissions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("access.permissions.empty")}</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("access.permissions.noMatch")}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((g) => (
              <div
                key={g.group}
                className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
              >
                <p className="mb-3 text-theme-sm font-medium text-gray-800 dark:text-white/90">
                  {groupLabel(g.group)}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {g.items.map((p) => (
                    <li
                      key={p.name}
                      title={p.name}
                      className="rounded-full bg-gray-100 px-2.5 py-1 text-theme-xs text-gray-700 dark:bg-white/5 dark:text-gray-300"
                    >
                      {actionLabel(p.action)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
