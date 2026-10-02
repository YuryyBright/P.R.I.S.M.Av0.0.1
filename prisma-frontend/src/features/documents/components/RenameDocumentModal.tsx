import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { Field } from "@/shared/ui/Field";
import { Modal } from "@/shared/ui/Modal";
import { btnPrimary, btnSecondary, inputClass } from "@/shared/ui/classes";
import { useDocumentActions } from "../hooks/useDocumentActions";
import type { DocumentItem } from "../types/document.types";
import { CheckIcon, SpinnerIcon, btnContent } from "./DocumentIcons";

interface Props {
  document: DocumentItem;
  onClose: () => void;
}

export function RenameDocumentModal({ document: doc, onClose }: Props) {
  const { t } = useTranslation();
  const { renameDocument, isMutating } = useDocumentActions();
  const [title, setTitle] = useState(doc.title);
  const [error, setError] = useState<string | null>(null);

  const trimmed = title.trim();
  const unchanged = trimmed === doc.title;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed || unchanged) return;
    setError(null);
    try {
      await renameDocument(doc.id, doc.collection_id, trimmed);
      onClose();
    } catch (err) {
      setError(
        isNormalizedApiError(err) ? err.message : t("errors.unexpected"),
      );
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("documents.rename.title")}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className={`${btnSecondary} ${btnContent} w-full sm:w-auto`}
            onClick={onClose}
            disabled={isMutating}
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            form="rename-document-form"
            className={`${btnPrimary} ${btnContent} w-full sm:w-auto sm:min-w-32`}
            disabled={isMutating || !trimmed || unchanged}
          >
            {isMutating ? <SpinnerIcon /> : <CheckIcon />}
            {t("common.save")}
          </button>
        </div>
      }
    >
      <form
        id="rename-document-form"
        onSubmit={submit}
        className="space-y-4"
        noValidate
      >
        {error && <Alert>{error}</Alert>}

        <Field label={t("documents.rename.label", "Назва документа")}>
          <div className="space-y-1.5">
            <input
              className={`${inputClass} w-full`}
              value={title}
              maxLength={512}
              autoFocus
              autoComplete="off"
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-theme-xs text-gray-500 dark:text-gray-400">
                {doc.filename && doc.filename !== doc.title
                  ? t("documents.rename.file", {
                      name: doc.filename,
                      defaultValue: "Файл: {name}",
                    })
                  : ""}
              </p>
              <span
                aria-hidden="true"
                className="shrink-0 text-theme-xs text-gray-400 tabular-nums dark:text-gray-500"
              >
                {title.length}/512
              </span>
            </div>
          </div>
        </Field>
      </form>
    </Modal>
  );
}
