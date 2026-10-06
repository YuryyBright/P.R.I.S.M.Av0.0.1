import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Can } from "@/features/auth";
import { COLLECTION_PERMISSIONS } from "../constants/collections.constants";
import { canManageCollection } from "../lib/collectionMappers";
import type { Collection } from "../types/collection.types";
import {
  ArchiveIcon,
  PencilIcon,
  RestoreIcon,
  SpinnerIcon,
  TrashIcon,
  UsersIcon,
} from "./CollectionIcons";
interface Props {
  collection: Collection;
  /** * icon: * Compact icon-only buttons with tooltips. * * labeled: * Icon + text buttons used in cards and collection header. */ variant:
    "icon" | "labeled";
  /** "active" (default): members / edit / archive. "archived": restore / delete forever. */
  mode?: "active" | "archived";
  onMembers?: () => void;
  onEdit?: () => void;
  /** Active mode: move to archive. */
  onDelete?: () => void;
  /** Archived mode. */
  onRestore?: () => void;
  /** Archived mode: permanent delete. */
  onPurge?: () => void;
  isRestoring?: boolean;
  className?: string;
}
const base =
  "inline-flex min-w-0 items-center justify-center gap-2 rounded-lg text-theme-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-50 [&>svg]:block [&>svg]:shrink-0";
const iconBtn =
  "size-9 text-gray-500 hover:bg-gray-100 hover:text-gray-800 active:bg-gray-200 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white/90 dark:active:bg-white/10";
const iconBtnDanger =
  "hover:bg-error-50 hover:text-error-600 active:bg-error-100 dark:hover:bg-error-500/10 dark:hover:text-error-400 dark:active:bg-error-500/20";
const labeledBtn =
  "h-10 border border-gray-200 bg-white px-3 text-gray-700 shadow-xs hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100 dark:border-white/10 dark:bg-white/3 dark:text-gray-300 dark:hover:border-white/20 dark:hover:bg-white/6 dark:active:bg-white/10";
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
        {" "}
        <span className="flex size-5 shrink-0 items-center justify-center">
          {" "}
          {icon}{" "}
        </span>{" "}
        <span className="truncate"> {label} </span>{" "}
      </button>
    );
  }
  return (
    <span className="group relative inline-flex">
      {" "}
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className={`${base} ${iconBtn} ${danger ? iconBtnDanger : ""}`}
      >
        {" "}
        <span className="flex size-5 shrink-0 items-center justify-center">
          {" "}
          {icon}{" "}
        </span>{" "}
      </button>{" "}
      {/* Visual tooltip only. The accessible name comes from aria-label. */}{" "}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 rounded-md bg-gray-900 px-2 py-1 text-theme-xs font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-has-focus-visible:opacity-100 dark:bg-gray-700"
      >
        {" "}
        {label}{" "}
      </span>{" "}
    </span>
  );
}
export function CollectionActions({
  collection,
  variant,
  mode = "active",
  onMembers,
  onEdit,
  onDelete,
  onRestore,
  onPurge,
  isRestoring = false,
  className = "",
}: Props) {
  const { t } = useTranslation();
  /** * Collection management requires: * 1. Global manage permission. * 2. Owner/manager role for this specific collection. */ if (
    !canManageCollection(collection)
  ) {
    return null;
  }
  return (
    <Can permission={COLLECTION_PERMISSIONS.manage}>
      {" "}
      <div
        role="group"
        aria-label={t("collections.table.actions", "Дії з колекцією")}
        className={`flex items-center gap-1 ${className}`}
      >
        {" "}
        {mode === "archived" ? (
          <>
            <ActionButton
              variant={variant}
              label={t("collections.archive.restore", "Відновити")}
              icon={
                isRestoring ? (
                  <SpinnerIcon className="size-5" />
                ) : (
                  <RestoreIcon className="size-5" />
                )
              }
              disabled={isRestoring}
              onClick={() => onRestore?.()}
            />
            <ActionButton
              variant={variant}
              danger
              label={t("collections.archive.purge", "Видалити назавжди")}
              icon={<TrashIcon className="size-5" />}
              disabled={isRestoring}
              onClick={() => onPurge?.()}
            />
          </>
        ) : (
          <>
            <ActionButton
              variant={variant}
              label={t("collections.table.members")}
              icon={<UsersIcon className="size-5" />}
              onClick={() => onMembers?.()}
            />
            <ActionButton
              variant={variant}
              label={t("common.edit")}
              icon={<PencilIcon className="size-5" />}
              onClick={() => onEdit?.()}
            />
            <ActionButton
              variant={variant}
              danger
              label={t("collections.archive.moveTo", "В архів")}
              icon={<ArchiveIcon className="size-5" />}
              onClick={() => onDelete?.()}
            />
          </>
        )}
      </div>{" "}
    </Can>
  );
}
