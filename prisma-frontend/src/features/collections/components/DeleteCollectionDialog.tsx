import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { Modal } from "@/shared/ui/Modal";
import { btnDanger, btnPrimary, btnSecondary } from "@/shared/ui/classes";

import { useCollectionActions } from "../hooks/useCollectionActions";
import {
  AlertTriangleIcon,
  ArchiveIcon,
  SpinnerIcon,
  TrashIcon,
  btnContent,
} from "./CollectionIcons";
interface Props {
  /**
   * "archive" (default): soft delete, the collection moves to the archive and can be restored.
   * "purge": permanent deletion of an already archived collection (irreversible).
   */
  mode?: "archive" | "purge";
  collectionId: string;
  collectionName?: string;
  onClose: () => void;
  onDeleted?: (message: string) => void;
}
export function DeleteCollectionDialog({
  mode = "archive",
  collectionId,
  collectionName,
  onClose,
  onDeleted,
}: Props) {
  const { t } = useTranslation();

  const { deleteCollection, purgeCollection, isMutating } =
    useCollectionActions();
  const purge = mode === "purge";
  const [error, setError] = useState<string | null>(null);
  async function confirm() {
    setError(null);
    try {
      if (purge) {
        await purgeCollection(collectionId);
        onDeleted?.(
          t("collections.archive.purged", "Колекцію остаточно видалено."),
        );
      } else {
        await deleteCollection(collectionId);
        onDeleted?.(
          t("collections.archive.archived", "Колекцію переміщено в архів."),
        );
      }
      onClose();
    } catch (e) {
      setError(isNormalizedApiError(e) ? e.message : t("errors.unexpected"));
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={
        purge
          ? t("collections.archive.purgeTitle", "Видалити назавжди?")
          : t("collections.archive.title", "Перемістити в архів?")
      }
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {" "}
          <button
            type="button"
            className={`${btnSecondary} ${btnContent} w-full sm:w-auto`}
            onClick={onClose}
            disabled={isMutating}
            autoFocus
          >
            {" "}
            {t("common.cancel")}{" "}
          </button>{" "}
          <button
            type="button"
            className={`${purge ? btnDanger : btnPrimary} ${btnContent} w-full sm:w-auto`}
            disabled={isMutating}
            onClick={confirm}
          >
            {" "}
            {isMutating ? (
              <SpinnerIcon className="size-5" />
            ) : purge ? (
              <TrashIcon className="size-5" />
            ) : (
              <ArchiveIcon className="size-5" />
            )}{" "}
            <span>
              {" "}
              {purge
                ? isMutating
                  ? t("common.deleting")
                  : t("collections.archive.purge", "Видалити назавжди")
                : isMutating
                  ? t("collections.archive.archiving", "Переміщення…")
                  : t("collections.archive.moveTo", "В архів")}{" "}
            </span>{" "}
          </button>{" "}
        </div>
      }
    >
      {" "}
      <div className="flex gap-4">
        {" "}
        <span
          aria-hidden="true"
          className={
            purge
              ? "flex size-11 shrink-0 items-center justify-center rounded-full bg-error-50 text-error-600 ring-8 ring-error-50/50 dark:bg-error-500/15 dark:text-error-400 dark:ring-error-500/5"
              : "flex size-11 shrink-0 items-center justify-center rounded-full bg-warning-50 text-warning-600 ring-8 ring-warning-50/50 dark:bg-warning-500/15 dark:text-orange-400 dark:ring-warning-500/5"
          }
        >
          {" "}
          {purge ? (
            <AlertTriangleIcon className="size-5" />
          ) : (
            <ArchiveIcon className="size-5" />
          )}{" "}
        </span>{" "}
        <div className="min-w-0 space-y-1.5">
          {" "}
          <p className="text-theme-sm leading-6 wrap-break-word text-gray-700 dark:text-gray-300">
            {" "}
            {purge
              ? collectionName
                ? t("collections.archive.purgeConfirm", {
                    name: collectionName,
                    defaultValue:
                      "Колекцію «{{name}}» та всі її документи буде видалено назавжди.",
                  })
                : t(
                    "collections.archive.purgeConfirmGeneric",
                    "Колекцію та всі її документи буде видалено назавжди.",
                  )
              : collectionName
                ? t("collections.archive.confirm", {
                    name: collectionName,
                    defaultValue:
                      "Колекцію «{{name}}» буде переміщено в архів.",
                  })
                : t(
                    "collections.archive.confirmGeneric",
                    "Колекцію буде переміщено в архів.",
                  )}
          </p>{" "}
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {" "}
            {purge
              ? t(
                  "collections.archive.purgeHint",
                  "Цю дію неможливо скасувати: документи та індекс буде видалено.",
                )
              : t(
                  "collections.archive.hint",
                  "Її можна відновити з вкладки «Архів».",
                )}{" "}
          </p>{" "}
        </div>{" "}
      </div>{" "}
      {error && (
        <div className="mt-4">
          {" "}
          <Alert>{error}</Alert>{" "}
        </div>
      )}{" "}
    </Modal>
  );
}
