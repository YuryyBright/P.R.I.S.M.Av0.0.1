import { useTranslation } from "react-i18next";
import { Can } from "@/features/auth";
import { formatDate, formatDateTime } from "@/shared/lib/date";
import type { UUID } from "@/shared/types/api";
import { USER_PERMISSIONS } from "../constants/users.constants";
import { userFullName, userStatus } from "../lib/userMappers";
import type { User } from "../types/user.types";
import { UserStatusBadge } from "./UserStatusBadge";

interface Props {
  rows: User[];
  isLoading: boolean;
  selectedIds: UUID[];
  onToggle: (id: UUID) => void;
  onToggleAll: (ids: UUID[], checked: boolean) => void;
  onEdit: (id: UUID) => void;
  onDelete: (id: UUID) => void;
}

const th =
  "px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400";
const td = "px-5 py-4 text-theme-sm text-gray-700 dark:text-gray-300";

export function UsersTable({
  rows,
  isLoading,
  selectedIds,
  onToggle,
  onToggleAll,
  onEdit,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const allChecked =
    rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
      <div className="max-w-full overflow-x-auto">
        <table className="min-w-full">
          <thead className="border-b border-gray-100 dark:border-white/5">
            <tr>
              <th className={th}>
                <input
                  type="checkbox"
                  aria-label={t("users.table.selectAll")}
                  checked={allChecked}
                  onChange={(e) =>
                    onToggleAll(
                      rows.map((r) => r.id),
                      e.target.checked,
                    )
                  }
                />
              </th>
              <th className={th}>{t("users.table.columns.user")}</th>
              <th className={th}>{t("users.table.columns.roles")}</th>
              <th className={th}>{t("users.table.columns.status")}</th>
              <th className={th}>{t("users.table.columns.expires")}</th>
              <th className={th}>{t("users.table.columns.created")}</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {isLoading && (
              <tr>
                <td className={td} colSpan={7}>
                  {t("common.loading")}
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td className={td} colSpan={7}>
                  {t("users.table.empty")}
                </td>
              </tr>
            )}
            {rows.map((u) => (
              <tr key={u.id}>
                <td className={td}>
                  <input
                    type="checkbox"
                    aria-label={t("users.table.selectRow", { email: u.email })}
                    checked={selectedIds.includes(u.id)}
                    onChange={() => onToggle(u.id)}
                  />
                </td>
                <td className={td}>
                  <div className="font-medium text-gray-800 dark:text-white/90">
                    {userFullName(u)}
                  </div>
                  <div className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {u.email}
                  </div>
                </td>
                <td className={td}>
                  <div className="flex flex-wrap gap-1">
                    {u.roles.length === 0 && "—"}
                    {u.roles.map((r) => (
                      <span
                        key={r.id}
                        className="rounded-md bg-brand-50 px-2 py-0.5 text-theme-xs text-brand-500 dark:bg-brand-500/15 dark:text-brand-400"
                      >
                        {r.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className={td}>
                  <UserStatusBadge status={userStatus(u)} />
                </td>
                <td className={td}>{formatDate(u.expiry_date)}</td>
                <td className={td}>{formatDateTime(u.created_at)}</td>
                <td className={`${td} text-end whitespace-nowrap`}>
                  <Can permission={USER_PERMISSIONS.update}>
                    <button
                      className="mr-3 text-brand-500 hover:underline"
                      onClick={() => onEdit(u.id)}
                    >
                      {t("common.edit")}
                    </button>
                  </Can>
                  <Can permission={USER_PERMISSIONS.delete}>
                    <button
                      className="text-error-500 hover:underline"
                      onClick={() => onDelete(u.id)}
                    >
                      {t("common.delete")}{" "}
                    </button>
                  </Can>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
