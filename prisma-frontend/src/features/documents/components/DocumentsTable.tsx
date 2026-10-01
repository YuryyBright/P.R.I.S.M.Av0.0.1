import { useTranslation } from "react-i18next";
import { Can } from "@/features/auth";
import { formatDateTime } from "@/shared/lib/date";
import { btnPrimary } from "@/shared/ui/classes";
import { DOCUMENT_PERMISSIONS } from "../constants/documents.constants";
import { formatBytes } from "../lib/documentFormat";
import type { DocumentItem } from "../types/document.types";
import { DocumentActions } from "./DocumentActions";
import { FileIcon, UploadIcon } from "./DocumentIcons";
import { DocumentStatusBadge } from "./DocumentStatusBadge";

interface Props {
  rows: DocumentItem[];
  isLoading: boolean;
  /** Collection role allows editing (owner/editor). Global permission is checked via <Can>. */
  canWrite: boolean;
  /** A status filter is active — the empty state explains that instead of inviting an upload. */
  isFiltered?: boolean;
  /** Optional: opens the file picker from the empty state. */
  onUpload?: () => void;
  onRename: (doc: DocumentItem) => void;
  onReindex: (doc: DocumentItem) => void;
  onDelete: (doc: DocumentItem) => void;
}

const th =
  "px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400";
const td =
  "px-5 py-4 align-middle text-theme-sm text-gray-700 dark:text-gray-300";
const surface =
  "overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3";
const skeleton =
  "animate-pulse rounded-md bg-gray-100 motion-reduce:animate-none dark:bg-white/5";

function FileTile() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500 ring-1 ring-gray-200/70 ring-inset dark:bg-white/5 dark:text-gray-400 dark:ring-white/5">
      <FileIcon className="size-5" />
    </span>
  );
}

function EmptyState({
  canWrite,
  isFiltered,
  onUpload,
}: Pick<Props, "canWrite" | "isFiltered" | "onUpload">) {
  const { t } = useTranslation();
  return (
    <div
      className={`${surface} flex flex-col items-center px-6 py-14 text-center`}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 ring-1 ring-gray-200/70 ring-inset dark:bg-white/5 dark:text-gray-500 dark:ring-white/5">
        <FileIcon className="size-6" />
      </span>
      <h3 className="mt-4 text-theme-sm font-medium text-gray-800 dark:text-white/90">
        {t("documents.table.empty")}
      </h3>
      <p className="mt-1 max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
        {isFiltered
          ? t(
              "documents.table.emptyFiltered",
              "Немає документів з таким статусом. Змініть фільтр, щоб побачити інші.",
            )
          : canWrite
            ? t(
                "documents.table.emptyHint",
                "Завантажте перші файли, щоб вони з'явилися в цій колекції.",
              )
            : t(
                "documents.table.emptyReadOnly",
                "У цій колекції ще немає документів.",
              )}
      </p>
      {canWrite && !isFiltered && onUpload && (
        <Can permission={DOCUMENT_PERMISSIONS.write}>
          <button
            type="button"
            className={`${btnPrimary} mt-6 gap-2`}
            onClick={onUpload}
          >
            <UploadIcon className="size-4" />

            {t("documents.upload.button")}
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
                <div className={`${skeleton} h-3.5 w-48`} />
                <div className={`${skeleton} h-3 w-32`} />
              </div>
            </div>
            {i === 0 && <span className="sr-only">{t("common.loading")}</span>}
          </td>
          <td className={td}>
            <div className={`${skeleton} h-3.5 w-14`} />
          </td>
          <td className={td}>
            <div className={`${skeleton} h-5 w-20 rounded-full`} />
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
              <div className={`${skeleton} h-3 w-1/3`} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <div className={`${skeleton} h-5 w-20 rounded-full`} />
          </div>
          {i === 0 && <span className="sr-only">{t("common.loading")}</span>}
        </li>
      ))}
    </>
  );
}

export function DocumentsTable({
  rows,
  isLoading,
  canWrite,
  isFiltered,
  onUpload,
  onRename,
  onReindex,
  onDelete,
}: Props) {
  const { t } = useTranslation();

  if (!isLoading && rows.length === 0) {
    return (
      <EmptyState
        canWrite={canWrite}
        isFiltered={isFiltered}
        onUpload={onUpload}
      />
    );
  }

  return (
    <div aria-busy={isLoading}>
      {/* ───────── Desktop / tablet: table ───────── */}
      <div className={`${surface} hidden md:block`}>
        <div className="max-w-full overflow-x-auto">
          <table className="min-w-full">
            <caption className="sr-only">
              {t("documents.table.caption", "Список документів")}
            </caption>
            <thead className="border-b border-gray-100 dark:border-white/5">
              <tr>
                <th scope="col" className={th}>
                  {t("documents.table.columns.document")}
                </th>
                <th scope="col" className={th}>
                  {t("documents.table.columns.size")}
                </th>
                <th scope="col" className={th}>
                  {t("documents.table.columns.status")}
                </th>
                <th scope="col" className={th}>
                  {t("documents.table.columns.added")}
                </th>
                <th scope="col" className={th}>
                  <span className="sr-only">
                    {t("documents.table.columns.actions", "Дії")}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {isLoading ? (
                <DesktopSkeletonRows />
              ) : (
                rows.map((d) => (
                  <tr
                    key={d.id}
                    className="transition-colors hover:bg-gray-50/60 dark:hover:bg-white/2"
                  >
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <FileTile />
                        <div className="min-w-0">
                          <p
                            className="max-w-md truncate font-medium text-gray-800 dark:text-white/90"
                            title={d.title}
                          >
                            {d.title}
                          </p>
                          {d.filename && d.filename !== d.title && (
                            <p
                              className="max-w-md truncate text-theme-xs text-gray-500 dark:text-gray-400"
                              title={d.filename}
                            >
                              {d.filename}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={`${td} whitespace-nowrap tabular-nums`}>
                      {formatBytes(d.size_bytes)}
                    </td>
                    <td className={td}>
                      <DocumentStatusBadge status={d.status} />
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {formatDateTime(d.created_at)}
                    </td>
                    <td className={`${td} text-end`}>
                      <DocumentActions
                        document={d}
                        canWrite={canWrite}
                        variant="icon"
                        className="justify-end"
                        onRename={() => onRename(d)}
                        onReindex={() => onReindex(d)}
                        onDelete={() => onDelete(d)}
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
          rows.map((d) => (
            <li key={d.id} className={`${surface} p-4`}>
              <div className="flex items-start gap-3">
                <FileTile />
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words text-gray-800 dark:text-white/90">
                    {d.title}
                  </p>
                  {d.filename && d.filename !== d.title && (
                    <p className="mt-0.5 truncate text-theme-xs text-gray-500 dark:text-gray-400">
                      {d.filename}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <DocumentStatusBadge status={d.status} />
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-theme-xs text-gray-500 dark:text-gray-400">
                <span className="tabular-nums">
                  {formatBytes(d.size_bytes)}
                </span>
                <span>{formatDateTime(d.created_at)}</span>
              </div>

              <DocumentActions
                document={d}
                canWrite={canWrite}
                variant="labeled"
                className="mt-4 flex-wrap border-t border-gray-100 pt-4 *:flex-1 dark:border-white/5"
                onRename={() => onRename(d)}
                onReindex={() => onReindex(d)}
                onDelete={() => onDelete(d)}
              />
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
