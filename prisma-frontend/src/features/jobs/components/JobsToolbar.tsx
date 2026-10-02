import { useTranslation } from "react-i18next";
import { btnSecondary, inputClass } from "@/shared/ui/classes";
import { JOB_STATUSES } from "../constants/jobs.constants";
import { parseJobStatus } from "../lib/jobFormat";
import type { JobStatus } from "../types/job.types";
import { RefreshIcon, SpinnerIcon, btnContent } from "./JobIcons";

interface Props {
  status: JobStatus | undefined;
  onStatus: (s: JobStatus | undefined) => void;
  onRefresh: () => void;
  isFetching: boolean;
  /** At least one visible job is active -> the list refreshes itself. */
  isPolling: boolean;
}

/** Status filter + manual refresh + "live" indicator. */
export function JobsToolbar({
  status,
  onStatus,
  onRefresh,
  isFetching,
  isPolling,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {isPolling && (
        <span
          role="status"
          className="inline-flex items-center gap-2 text-theme-xs text-gray-500 dark:text-gray-400"
        >
          <span
            aria-hidden="true"
            className="size-1.5 animate-pulse rounded-full bg-brand-500 motion-reduce:animate-none"
          />
          {t("jobs.live", "Оновлюється автоматично")}
        </span>
      )}

      <select
        className={`${inputClass} h-10 w-full sm:w-auto`}
        value={status ?? ""}
        onChange={(e) => onStatus(parseJobStatus(e.target.value))}
        aria-label={t("jobs.filter.label")}
      >
        <option value="">{t("jobs.filter.all")}</option>
        {JOB_STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(`jobs.status.${s}`)}
          </option>
        ))}
      </select>

      <button
        type="button"
        className={`${btnSecondary} ${btnContent} h-10 w-full sm:w-auto`}
        onClick={onRefresh}
        disabled={isFetching}
        aria-busy={isFetching}
      >
        {isFetching ? (
          <SpinnerIcon className="size-4.5" />
        ) : (
          <RefreshIcon className="size-4.5" />
        )}
        {t("jobs.toolbar.refresh", "Оновити")}
      </button>
    </div>
  );
}
