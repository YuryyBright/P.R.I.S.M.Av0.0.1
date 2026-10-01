import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Can } from "@/features/auth";
import { DOCUMENT_PERMISSIONS } from "../constants/documents.constants";
import { isActiveStatus } from "../lib/documentFormat";
import type { DocumentItem } from "../types/document.types";
import { PencilIcon, RefreshIcon, TrashIcon } from "./DocumentIcons";

interface Props {
  document: DocumentItem;
  /** Collection role allows editing (owner/editor). Global permission is checked via <Can>. */
  canWrite: boolean;
  /** `icon` — compact icon buttons with tooltips (table); `labeled` — icon + text (cards). */
  variant: "icon" | "labeled";
  onRename: () => void;
  onReindex: () => void;
  onDelete: () => void;
  className?: string;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg text-theme-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-50";

const iconBtn =
  "size-9 text-gray-500 hover:bg-gray-100 hover:text-gray-800 active:bg-gray-200 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white/90 dark:active:bg-white/10";
const iconBtnDanger =
  "hover:bg-error-50 hover:text-error-600 active:bg-error-100 dark:hover:bg-error-500/10 dark:hover:text-error-400 dark:active:bg-error-500/20";

const labeledBtn =
  "h-10 min-w-fit border border-gray-200 bg-white px-3 text-gray-700 shadow-xs hover:bg-gray-50 active:bg-gray-100 dark:border-white/10 dark:bg-white/3 dark:text-gray-300 dark:hover:bg-white/6 dark:active:bg-white/10";
const labeledBtnDanger =
  "text-error-600 hover:border-error-200 hover:bg-error-50 active:bg-error-100 dark:text-error-400 dark:hover:border-error-500/30 dark:hover:bg-error-500/10";

interface ActionButtonProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant: Props["variant"];
  danger?: boolean;
  disabled?: boolean;
}

function ActionButton({
  label,
  icon,
  onClick,
  variant,
  danger,
  disabled,
}: ActionButtonProps) {
  if (variant === "labeled") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`${base} ${labeledBtn} ${danger ? labeledBtnDanger : ""}`}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className={`${base} ${iconBtn} ${danger ? iconBtnDanger : ""}`}
      >
        {icon}
      </button>
      {/* Visual tooltip only — the accessible name comes from aria-label. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 rounded-md bg-gray-900 px-2 py-1 text-theme-xs font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-has-focus-visible:opacity-100 dark:bg-gray-700"
      >
        {label}
      </span>
    </span>
  );
}

export function DocumentActions({
  document: doc,
  canWrite,
  variant,
  onRename,
  onReindex,
  onDelete,
  className = "",
}: Props) {
  const { t } = useTranslation();

  if (!canWrite) return null;

  const busy = isActiveStatus(doc.status);

  return (
    <Can permission={DOCUMENT_PERMISSIONS.write}>
      <div
        role="group"
        aria-label={t("documents.table.actions", "Дії з документом")}
        className={`flex items-center gap-1 ${className}`}
      >
        <ActionButton
          variant={variant}
          label={t("common.edit")}
          icon={<PencilIcon />}
          onClick={onRename}
        />
        <ActionButton
          variant={variant}
          label={
            busy && variant === "icon"
              ? t("documents.table.reindexBusy", "Індексація вже триває")
              : t("documents.table.reindex")
          }
          icon={<RefreshIcon />}
          disabled={busy}
          onClick={onReindex}
        />
        <ActionButton
          variant={variant}
          danger
          label={t("common.delete")}
          icon={<TrashIcon />}
          onClick={onDelete}
        />
      </div>
    </Can>
  );
}
