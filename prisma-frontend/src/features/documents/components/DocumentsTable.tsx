import { useTranslation } from "react-i18next";
import { Can } from "@/features/auth";
import { formatDateTime } from "@/shared/lib/date";
import { btnPrimary } from "@/shared/ui/classes";
import { DOCUMENT_PERMISSIONS } from "../constants/documents.constants";
import { formatBytes } from "../lib/documentFormat";
import { btnContent, mutedText, skeleton, surface } from "../lib/styles";
import type { DocumentItem } from "../types/document.types";
import { DocumentActions } from "./DocumentActions";
import { UploadIcon } from "./DocumentIcons";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import { EmptyState } from "./EmptyState";
import { FileTile } from "./FileTile";

interface Props {
  rows: DocumentItem[];
  isLoading: boolean;
  canWrite: boolean;
  isFiltered?: boolean;
  onUpload?: () => void;
  onDetails: (doc: DocumentItem) => void;
  onRename: (doc: DocumentItem) => void;
  onReindex: (doc: DocumentItem) => void;
  onDelete: (doc: DocumentItem) => void;
}

type RowHandlers = Pick<
  Props,
  "canWrite" | "onDetails" | "onRename" | "onReindex" | "onDelete"
>;

const th = `px-5 py-3 text-start text-theme-xs font-medium ${mutedText}`;
const td =
  "px-5 py-4 align-middle text-theme-sm text-gray-700 dark:text-gray-300";

const rowHover =
  "group/item transition-colors hover:bg-brand-50/40 focus-within:bg-brand-50/40 dark:hover:bg-brand-500/5 dark:focus-within:bg-brand-500/5";
const cardHover =
  "group/item relative transition-all duration-200 hover:border-brand-200 hover:shadow-sm focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-500/15 dark:hover:border-brand-500/30 dark:focus-within:border-brand-500/40 dark:focus-within:ring-brand-500/10";

const titleButton =
  "text-start font-medium text-gray-800 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:text-white/90 dark:hover:text-brand-400";

/* ───────────── shared pieces ───────────── */

function DocumentName({
  doc,
  onOpen,
  compact,
}: {
  doc: DocumentItem;
  onOpen: () => void;
  compact?: boolean;
}) {
  const showFilename = doc.filename && doc.filename !== doc.title;
  return (
    <div className="min-w-0 flex-1">
      <button
        type="button"
        onClick={onOpen}
        title={doc.title}
        className={
          compact
            ? `${titleButton} wrap-break-word`
            : `${titleButton} block max-w-md truncate hover:underline`
        }
      >
        {doc.title}
      </button>
      {showFilename && (
        <p
          title={doc.filename ?? undefined}
          className={`truncate text-theme-xs ${mutedText} ${compact ? "mt-0.5" : "max-w-md"}`}
        >
          {doc.filename}
        </p>
      )}
    </div>
  );
}

function Empty({
  canWrite,
  isFiltered,
  onUpload,
}: Pick<Props, "canWrite" | "isFiltered" | "onUpload">) {
  const { t } = useTranslation();

  const hint = isFiltered
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
        );

  const action =
    canWrite && !isFiltered && onUpload ? (
      <Can permission={DOCUMENT_PERMISSIONS.write}>
        <button
          type="button"
          className={`${btnPrimary} ${btnContent}`}
          onClick={onUpload}
        >
          <UploadIcon className="size-5" />
          {t("documents.upload.button")}
        </button>
      </Can>
    ) : undefined;

  return (
    <EmptyState
      title={t("documents.table.empty")}
      hint={hint}
      action={action}
    />
  );
}

/* ───────────── loading skeletons ───────────── */

function SkeletonRows() {
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

function SkeletonCards() {
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
          <div className={`${skeleton} mt-4 h-5 w-20 rounded-full`} />
          {i === 0 && <span className="sr-only">{t("common.loading")}</span>}
        </li>
      ))}
    </>
  );
}

/* ───────────── desktop row / mobile card ───────────── */

function Row({
  doc,
  canWrite,
  onDetails,
  onRename,
  onReindex,
  onDelete,
}: RowHandlers & { doc: DocumentItem }) {
  return (
    <tr className={rowHover}>
      <td className={td}>
        <div className="flex items-center gap-3">
          <FileTile />
          <DocumentName doc={doc} onOpen={() => onDetails(doc)} />
        </div>
      </td>
      <td className={`${td} whitespace-nowrap tabular-nums`}>
        {formatBytes(doc.size_bytes)}
      </td>
      <td className={td}>
        <DocumentStatusBadge status={doc.status} />
      </td>
      <td className={`${td} whitespace-nowrap tabular-nums`}>
        {formatDateTime(doc.created_at)}
      </td>
      <td className={`${td} text-end`}>
        <DocumentActions
          document={doc}
          canWrite={canWrite}
          variant="icon"
          className="justify-end"
          onDetails={() => onDetails(doc)}
          onRename={() => onRename(doc)}
          onReindex={() => onReindex(doc)}
          onDelete={() => onDelete(doc)}
        />
      </td>
    </tr>
  );
}

function Card({
  doc,
  canWrite,
  onDetails,
  onRename,
  onReindex,
  onDelete,
}: RowHandlers & { doc: DocumentItem }) {
  return (
    <li className={`${surface} ${cardHover} p-4`}>
      <div className="flex items-start gap-3">
        <FileTile />
        <DocumentName doc={doc} onOpen={() => onDetails(doc)} compact />
      </div>
      <div className="mt-3">
        <DocumentStatusBadge status={doc.status} />
      </div>
      <div
        className={`mt-3 flex flex-wrap gap-x-4 gap-y-1 text-theme-xs tabular-nums ${mutedText}`}
      >
        <span>{formatBytes(doc.size_bytes)}</span>
        <span>{formatDateTime(doc.created_at)}</span>
      </div>
      <DocumentActions
        document={doc}
        canWrite={canWrite}
        variant="labeled"
        className="mt-4 flex-wrap border-t border-gray-100 pt-4 *:flex-1 dark:border-white/5"
        onDetails={() => onDetails(doc)}
        onRename={() => onRename(doc)}
        onReindex={() => onReindex(doc)}
        onDelete={() => onDelete(doc)}
      />
    </li>
  );
}

/* ───────────── table ───────────── */

export function DocumentsTable({
  rows,
  isLoading,
  canWrite,
  isFiltered,
  onUpload,
  ...handlers
}: Props) {
  const { t } = useTranslation();

  if (!isLoading && rows.length === 0) {
    return (
      <Empty canWrite={canWrite} isFiltered={isFiltered} onUpload={onUpload} />
    );
  }

  const rowProps = { canWrite, ...handlers };

  return (
    <div aria-busy={isLoading}>
      {/* Desktop / tablet */}
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
                <SkeletonRows />
              ) : (
                rows.map((d) => <Row key={d.id} doc={d} {...rowProps} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile */}
      <ul className="space-y-3 md:hidden">
        {isLoading ? (
          <SkeletonCards />
        ) : (
          rows.map((d) => <Card key={d.id} doc={d} {...rowProps} />)
        )}
      </ul>
    </div>
  );
}
