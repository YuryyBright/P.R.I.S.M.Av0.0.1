import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/shared/ui/Alert";
import { Modal } from "@/shared/ui/Modal";
import { btnDanger, btnSecondary } from "@/shared/ui/classes";
import { useDocumentActions } from "../hooks/useDocumentActions";
import { actionErrorMessage } from "../lib/errors";
import { btnContent } from "../lib/styles";
import type { DocumentItem } from "../types/document.types";
import { AlertTriangleIcon, SpinnerIcon, TrashIcon } from "./DocumentIcons";

interface Props {
  document: DocumentItem;
  onClose: () => void;
  /** Called after a successful delete (e.g. leave the document page). */
  onDeleted?: () => void;
}

export function DeleteDocumentDialog({
  document: doc,
  onClose,
  onDeleted,
}: Props) {
  const { t } = useTranslation();
  const { deleteDocument, isMutating } = useDocumentActions();
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    try {
      await deleteDocument(doc.id, doc.collection_id); // 204, no body
      onDeleted?.();
      onClose();
    } catch (e) {
      setError(actionErrorMessage(e, t("errors.unexpected")));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("documents.delete.title")}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {/* Cancel is the default focus: the destructive action needs a deliberate choice. */}
          <button
            type="button"
            className={`${btnSecondary} ${btnContent} w-full sm:w-auto`}
            onClick={onClose}
            disabled={isMutating}
            autoFocus
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className={`${btnDanger} ${btnContent} w-full sm:w-auto`}
            disabled={isMutating}
            onClick={confirm}
          >
            {isMutating ? <SpinnerIcon /> : <TrashIcon />}
            {isMutating ? t("common.deleting") : t("common.delete")}
          </button>
        </div>
      }
    >
      <div className="flex gap-4">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-error-50 text-error-600 ring-8 ring-error-50/50 dark:bg-error-500/15 dark:text-error-400 dark:ring-error-500/5"
        >
          <AlertTriangleIcon className="size-5" />
        </span>

        <div className="min-w-0 space-y-1.5">
          <p className="text-theme-sm leading-6 wrap-break-word text-gray-700 dark:text-gray-300">
            {t("documents.delete.confirm", { name: doc.title })}
          </p>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {t("documents.delete.hint", "Цю дію неможливо скасувати.")}
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}
    </Modal>
  );
}
