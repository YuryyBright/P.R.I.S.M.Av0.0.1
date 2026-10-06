import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { Modal } from "@/shared/ui/Modal";
import { btnDanger, btnSecondary } from "@/shared/ui/classes";

import { useCollectionActions } from "../hooks/useCollectionActions";
import {
  AlertTriangleIcon,
  SpinnerIcon,
  TrashIcon,
  btnContent,
} from "./CollectionIcons";
interface Props {
  collectionId: string;
  collectionName?: string;
  onClose: () => void;
  onDeleted?: (message: string) => void;
}
export function DeleteCollectionDialog({
  collectionId,
  collectionName,
  onClose,
  onDeleted,
}: Props) {
  const { t } = useTranslation();

  const { deleteCollection, isMutating } = useCollectionActions();
  const [error, setError] = useState<string | null>(null);
  async function confirm() {
    setError(null);
    try {
      await deleteCollection(collectionId);
      onDeleted?.(t("collections.delete.deleted"));
      onClose();
    } catch (e) {
      setError(isNormalizedApiError(e) ? e.message : t("errors.unexpected"));
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={t("collections.delete.title")}
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
            className={`${btnDanger} ${btnContent} w-full sm:w-auto`}
            disabled={isMutating}
            onClick={confirm}
          >
            {" "}
            {isMutating ? (
              <SpinnerIcon className="size-5" />
            ) : (
              <TrashIcon className="size-5" />
            )}{" "}
            <span>
              {" "}
              {isMutating ? t("common.deleting") : t("common.delete")}{" "}
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
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-error-50 text-error-600 ring-8 ring-error-50/50 dark:bg-error-500/15 dark:text-error-400 dark:ring-error-500/5"
        >
          {" "}
          <AlertTriangleIcon className="size-5" />{" "}
        </span>{" "}
        <div className="min-w-0 space-y-1.5">
          {" "}
          <p className="text-theme-sm leading-6 wrap-break-word text-gray-700 dark:text-gray-300">
            {" "}
            {collectionName
              ? t("collections.delete.confirm", { name: collectionName })
              : t("collections.delete.confirmGeneric")}
          </p>{" "}
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {" "}
            {t("collections.delete.hint", "Цю дію неможливо скасувати.")}{" "}
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
