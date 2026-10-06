import { useTranslation } from "react-i18next";

import { formatDuration, isActiveJob, jobEventTime } from "../lib/jobFormat";
import type { JobListItem } from "../types/job.types";
import { useRelativeTime } from "../hooks/useRelativeTime";
import { JobNotificationTile } from "./JobNotificationTile";
import { JobProgress } from "./JobProgress";

interface Props {
  job: JobListItem;
  unread: boolean;
}

export function JobNotificationBody({ job, unread }: Props) {
  const { t } = useTranslation();
  const relTime = useRelativeTime();

  const active = isActiveJob(job.status);

  const title =
    job.document_title ??
    t("jobs.table.documentDeleted", {
      defaultValue: "Документ видалено",
    });

  const type = t(`jobs.type.${job.job_type}`, {
    defaultValue: job.job_type,
  });

  const status = t(`jobs.status.${job.status}`, {
    defaultValue: job.status,
  });

  return (
    <>
      <JobNotificationTile status={job.status} />

      <span className="block min-w-0 flex-1">
        <span className="block truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
          {title}
        </span>

        {job.status === "failed" ? (
          <span className="mt-0.5 line-clamp-2 text-theme-xs text-error-600 dark:text-error-400">
            {job.error_message ??
              t("header.notifications.failedFallback", {
                defaultValue: "Обробка завершилась помилкою",
              })}
          </span>
        ) : active ? (
          <JobProgress job={job} className="mt-1.5" />
        ) : (
          <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
            {status}
            {job.status === "completed" &&
              ` · ${formatDuration(job.started_at, job.finished_at)}`}
          </span>
        )}

        <span className="mt-1 flex items-center gap-2 text-theme-xs text-gray-400 dark:text-gray-500">
          <span>{type}</span>
          <span className="size-1 rounded-full bg-gray-300 dark:bg-gray-600" />
          <span>{relTime(jobEventTime(job))}</span>
        </span>
      </span>

      {unread && (
        <span
          aria-label={t("header.notifications.unread", {
            defaultValue: "Непрочитане",
          })}
          className={`mt-1.5 size-2 shrink-0 rounded-full ${
            job.status === "failed" ? "bg-error-500" : "bg-brand-500"
          }`}
        />
      )}
    </>
  );
}
