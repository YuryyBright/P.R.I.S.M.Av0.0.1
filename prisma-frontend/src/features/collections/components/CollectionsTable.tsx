import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Can } from "@/features/auth";
import { formatDateTime } from "@/shared/lib/date";
import type { UUID } from "@/shared/types/api";
import { btnPrimary } from "@/shared/ui/classes";
import {
  COLLECTION_PERMISSIONS,
  COLLECTIONS_ROUTES,
} from "../constants/collections.constants";
import type { Collection } from "../types/collection.types";
import { CollectionActions } from "./CollectionActions";
import { RoleBadge, VisibilityBadge } from "./CollectionBadges";
import { FolderIcon, PlusIcon, btnContent } from "./CollectionIcons";

interface Props {
  rows: Collection[];
  isLoading: boolean;
  onEdit: (id: UUID) => void;
  onMembers: (id: UUID) => void;
  onDelete: (id: UUID) => void;
  /** Optional: shows a call-to-action inside the empty state. */
  onCreate?: () => void;
}

const th =
  "px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400";
const td =
  "px-5 py-4 align-middle text-theme-sm text-gray-700 dark:text-gray-300";
const surface =
  "overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3";
/** Interactive card: lifts and highlights on hover / keyboard focus. */
const cardInteractive =
  "group/card relative transition-all duration-200 hover:border-brand-200 hover:shadow-sm focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-500/15 dark:hover:border-brand-500/30 dark:focus-within:border-brand-500/40 dark:focus-within:ring-brand-500/10";
const skeleton =
  "animate-pulse rounded-md bg-gray-100 motion-reduce:animate-none dark:bg-white/5";
const nameLink =
  "rounded font-medium text-gray-800 underline-offset-4 transition-colors hover:text-brand-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-white/90 dark:hover:text-brand-400";

function FolderTile() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500 ring-1 ring-gray-200/70 transition-colors ring-inset group-hover/card:bg-brand-50 group-hover/card:text-brand-500 group-hover/card:ring-brand-200 group-hover/row:bg-brand-50 group-hover/row:text-brand-500 group-hover/row:ring-brand-200 dark:bg-white/5 dark:text-gray-400 dark:ring-white/5 dark:group-hover/card:bg-brand-500/15 dark:group-hover/card:text-brand-400 dark:group-hover/card:ring-brand-500/20 dark:group-hover/row:bg-brand-500/15 dark:group-hover/row:text-brand-400 dark:group-hover/row:ring-brand-500/20">
      <FolderIcon className="size-5" />
    </span>
  );
}

function EmptyState({ onCreate }: { onCreate?: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      className={`${surface} flex flex-col items-center px-6 py-14 text-center`}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 ring-1 ring-gray-200/70 ring-inset dark:bg-white/5 dark:text-gray-500 dark:ring-white/5">
        <FolderIcon className="size-6" />
      </span>
      <h2 className="mt-4 text-theme-sm font-medium text-gray-800 dark:text-white/90">
        {t("collections.table.empty")}
      </h2>
      <p className="mt-1 max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
        {t(
          "collections.table.emptyHint",
          "Створіть першу колекцію, щоб організувати матеріали та запросити учасників.",
        )}
      </p>
      {onCreate && (
        <Can permission={COLLECTION_PERMISSIONS.create}>
          <button
            type="button"
            className={`${btnPrimary} ${btnContent} mt-6`}
            onClick={onCreate}
          >
            <PlusIcon className="size-4.5" />
            {t("collections.toolbar.new")}
          </button>
        </Can>
      )}
    </div>
  );
}

function DesktopSkeletonRows() {
  const { t } = useTranslation();
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <tr key={i}>
          <td className={td}>
            <div className="flex items-center gap-3">
              <div className={`${skeleton} size-10 rounded-xl`} />
              <div className="space-y-2">
                <div className={`${skeleton} h-3.5 w-40`} />
                <div className={`${skeleton} h-3 w-56`} />
              </div>
            </div>
            {i === 0 && <span className="sr-only">{t("common.loading")}</span>}
          </td>
          <td className={td}>
            <div className={`${skeleton} h-5 w-20 rounded-full`} />
          </td>
          <td className={td}>
            <div className={`${skeleton} h-5 w-16 rounded-full`} />
          </td>
          <td className={td}>
            <div className={`${skeleton} h-3.5 w-28`} />
          </td>
          <td className={td} />
        </tr>
      ))}
    </>
  );
}

function CardSkeletons() {
  const { t } = useTranslation();
  return (
    <>
      {[0, 1, 2].map((i) => (
        <li key={i} className={`${surface} p-4`}>
          <div className="flex items-center gap-3">
            <div className={`${skeleton} size-10 rounded-xl`} />
            <div className="flex-1 space-y-2">
              <div className={`${skeleton} h-3.5 w-2/3`} />
              <div className={`${skeleton} h-3 w-full`} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <div className={`${skeleton} h-5 w-20 rounded-full`} />
            <div className={`${skeleton} h-5 w-16 rounded-full`} />
          </div>
          {i === 0 && <span className="sr-only">{t("common.loading")}</span>}
        </li>
      ))}
    </>
  );
}

export function CollectionsTable({
  rows,
  isLoading,
  onEdit,
  onMembers,
  onDelete,
  onCreate,
}: Props) {
  const { t } = useTranslation();

  if (!isLoading && rows.length === 0) {
    return <EmptyState onCreate={onCreate} />;
  }

  return (
    <div aria-busy={isLoading}>
      {/* ───────── Desktop / tablet: table ───────── */}
      <div className={`${surface} hidden md:block`}>
        <div className="max-w-full overflow-x-auto">
          <table className="min-w-full">
            <caption className="sr-only">
              {t("collections.table.caption", "Список колекцій")}
            </caption>
            <thead className="border-b border-gray-100 dark:border-white/5">
              <tr>
                <th scope="col" className={th}>
                  {t("collections.table.columns.collection")}
                </th>
                <th scope="col" className={th}>
                  {t("collections.table.columns.visibility")}
                </th>
                <th scope="col" className={th}>
                  {t("collections.table.columns.myRole")}
                </th>
                <th scope="col" className={th}>
                  {t("collections.table.columns.created")}
                </th>
                <th scope="col" className={th}>
                  <span className="sr-only">
                    {t("collections.table.columns.actions", "Дії")}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {isLoading ? (
                <DesktopSkeletonRows />
              ) : (
                rows.map((c) => (
                  <tr
                    key={c.id}
                    className="group/row transition-colors focus-within:bg-brand-50/40 hover:bg-brand-50/40 dark:focus-within:bg-brand-500/5 dark:hover:bg-brand-500/5"
                  >
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <FolderTile />
                        <div className="min-w-0">
                          <Link
                            to={COLLECTIONS_ROUTES.detail(c.id)}
                            className={nameLink}
                          >
                            {c.name}
                          </Link>
                          {c.description && (
                            <p className="max-w-md truncate text-theme-xs text-gray-500 dark:text-gray-400">
                              {c.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={td}>
                      <VisibilityBadge visibility={c.visibility} />
                    </td>
                    <td className={td}>
                      <RoleBadge role={c.my_role} />
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {formatDateTime(c.created_at)}
                    </td>
                    <td className={`${td} text-end`}>
                      <CollectionActions
                        collection={c}
                        variant="icon"
                        className="justify-end"
                        onMembers={() => onMembers(c.id)}
                        onEdit={() => onEdit(c.id)}
                        onDelete={() => onDelete(c.id)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ───────── Mobile: cards ───────── */}
      <ul className="space-y-3 md:hidden">
        {isLoading ? (
          <CardSkeletons />
        ) : (
          rows.map((c) => (
            <li key={c.id} className={`${surface} ${cardInteractive} p-4`}>
              <div className="flex items-start gap-3">
                <FolderTile />
                <div className="min-w-0 flex-1">
                  <Link
                    to={COLLECTIONS_ROUTES.detail(c.id)}
                    className={`${nameLink} block wrap-break-word`}
                  >
                    {c.name}
                  </Link>
                  {c.description && (
                    <p className="mt-0.5 line-clamp-2 text-theme-xs text-gray-500 dark:text-gray-400">
                      {c.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <VisibilityBadge visibility={c.visibility} />
                <RoleBadge role={c.my_role} />
              </div>

              <p className="mt-3 text-theme-xs text-gray-500 dark:text-gray-400">
                {t("collections.table.columns.created")}:{" "}
                {formatDateTime(c.created_at)}
              </p>

              <CollectionActions
                collection={c}
                variant="labeled"
                className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-4 dark:border-white/5"
                onMembers={() => onMembers(c.id)}
                onEdit={() => onEdit(c.id)}
                onDelete={() => onDelete(c.id)}
              />
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
