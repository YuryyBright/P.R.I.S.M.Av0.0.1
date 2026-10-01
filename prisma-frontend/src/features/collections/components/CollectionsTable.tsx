import { useTranslation } from "react-i18next";
import { Can } from "@/features/auth";
import { formatDateTime } from "@/shared/lib/date";
import type { UUID } from "@/shared/types/api";
import { COLLECTION_PERMISSIONS } from "../constants/collections.constants";
import { canManageCollection } from "../lib/collectionMappers";
import type { Collection } from "../types/collection.types";
import { RoleBadge, VisibilityBadge } from "./CollectionBadges";

interface Props {
  rows: Collection[];
  isLoading: boolean;
  onEdit: (id: UUID) => void;
  onMembers: (id: UUID) => void;
  onDelete: (id: UUID) => void;
}

const th =
  "px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400";
const td = "px-5 py-4 text-theme-sm text-gray-700 dark:text-gray-300";

export function CollectionsTable({
  rows,
  isLoading,
  onEdit,
  onMembers,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="max-w-full overflow-x-auto">
        <table className="min-w-full">
          <thead className="border-b border-gray-100 dark:border-white/[0.05]">
            <tr>
              <th className={th}>{t("collections.table.columns.collection")}</th>
              <th className={th}>{t("collections.table.columns.visibility")}</th>
              <th className={th}>{t("collections.table.columns.myRole")}</th>
              <th className={th}>{t("collections.table.columns.created")}</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {isLoading && (
              <tr>
                <td className={td} colSpan={5}>
                  {t("common.loading")}
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td className={td} colSpan={5}>
                  {t("collections.table.empty")}
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr key={c.id}>
                <td className={td}>
                  <div className="font-medium text-gray-800 dark:text-white/90">
                    {c.name}
                  </div>
                  {c.description && (
                    <div className="max-w-md truncate text-theme-xs text-gray-500 dark:text-gray-400">
                      {c.description}
                    </div>
                  )}
                </td>
                <td className={td}>
                  <VisibilityBadge visibility={c.visibility} />
                </td>
                <td className={td}>
                  <RoleBadge role={c.my_role} />
                </td>
                <td className={td}>{formatDateTime(c.created_at)}</td>
                <td className={`${td} text-end whitespace-nowrap`}>
                  {/* manage = global permission AND owner role on this collection */}
                  {canManageCollection(c) && (
                    <Can permission={COLLECTION_PERMISSIONS.manage}>
                      <button
                        className="mr-3 text-brand-500 hover:underline"
                        onClick={() => onMembers(c.id)}
                      >
                        {t("collections.table.members")}
                      </button>
                      <button
                        className="mr-3 text-brand-500 hover:underline"
                        onClick={() => onEdit(c.id)}
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        className="text-error-500 hover:underline"
                        onClick={() => onDelete(c.id)}
                      >
                        {t("common.delete")}
                      </button>
                    </Can>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
