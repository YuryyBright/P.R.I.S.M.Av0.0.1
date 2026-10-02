import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { Modal } from "@/shared/ui/Modal";
import { btnDanger, btnSecondary } from "@/shared/ui/classes";
import { useJobActions } from "../hooks/useJobActions";
import type { JobListItem } from "../types/job.types";
import {
  AlertTriangleIcon,
  SpinnerIcon,
  StopIcon,
  btnContent,
} from "./JobIcons";

interface Props {
  job: JobListItem;
  onClose: () => void;
}

export function CancelJobDialog({ job, onClose }: Props) {
  const { t } = useTranslation();
  const { cancelJob, isMutating } = useJobActions();
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    try {
      await cancelJob(job.id);
      onClose();
    } catch (e) {
      // 409 = the job finished by itself in the meantime.
      setError(isNormalizedApiError(e) ? e.message : t("errors.unexpected"));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("jobs.cancel.title", "Скасувати job?")}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {/* "Keep running" is the default focus: the destructive action needs a deliberate choice. */}
          <button
            type="button"
            className={`${btnSecondary} ${btnContent} w-full sm:w-auto`}
            onClick={onClose}
            disabled={isMutating}
            autoFocus
          >
            {t("jobs.cancel.keep", "Залишити")}
          </button>
          <button
            type="button"
            className={`${btnDanger} ${btnContent} w-full sm:w-auto`}
            disabled={isMutating}
            onClick={confirm}
          >
            {isMutating ? <SpinnerIcon /> : <StopIcon />}
            {isMutating
              ? t("jobs.cancel.cancelling", "Скасування…")
              : t("jobs.actions.cancel")}
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
            {t("jobs.cancel.confirm", {
              name: job.document_title ?? "—",
              defaultValue: "Зупинити індексацію «{{name}}»?",
            })}
          </p>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {t(
              "jobs.cancel.hint",
              "Документ, який ще не готовий, отримає статус «Помилка». Його можна переіндексувати за допомогою «Повторити».",
            )}
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
