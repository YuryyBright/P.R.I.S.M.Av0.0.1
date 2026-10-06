import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  formatDuration,
  isActiveJob,
  jobEventTime,
  relativeTimeParts,
} from "../lib/jobFormat";
import { JOBS_ROUTES } from "../constants/jobs.constants";
import type { JobListItem, JobStatus } from "../types/job.types";
import {
  AlertTriangleIcon,
  CheckIcon,
  QueueIcon,
  SpinnerIcon,
  StopIcon,
} from "./JobIcons";
import { JobProgress } from "./JobProgress";

const TILE: Record<JobStatus, { cls: string; icon: ReactNode }> = {
  queued: {
    cls: "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
    icon: <QueueIcon className="size-5" />,
  },
  processing: {
    cls: "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400",
    icon: <SpinnerIcon className="size-5" />,
  },
  completed: {
    cls: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400",
    icon: <CheckIcon className="size-5" />,
  },
  failed: {
    cls: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
    icon: <AlertTriangleIcon className="size-5" />,
  },
  cancelled: {
    cls: "bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500",
    icon: <StopIcon className="size-5" />,
  },
};

/** Where a notification leads: the jobs list pre-filtered by that status. */
export const jobNotificationLink = (job: JobListItem) =>
  `${JOBS_ROUTES.list}?status=${job.status}`;

export function useRelativeTime() {
  const { t } = useTranslation();
  return (time: number) => {
    const { unit, count } = relativeTimeParts(time);
    switch (unit) {
      case "now":
        return t("header.notifications.justNow", { defaultValue: "щойно" });
      case "min":
        return t("header.notifications.minAgo", { count });
      case "hr":
        return t("header.notifications.hrAgo", { count });
      default:
        return t("header.notifications.dayAgo", {
          count,
          defaultValue: "{{count}} дн. тому",
        });
    }
  };
}

interface Props {
  job: JobListItem;
  unread: boolean;
}

/** Visual body of one notification row (wrap it in a DropdownItem). */
export function JobNotificationBody({ job, unread }: Props) {
  const { t } = useTranslation();
  const relTime = useRelativeTime();
  const tile = TILE[job.status] ?? TILE.queued;
  const active = isActiveJob(job.status);

  const title =
    job.document_title ??
    t("jobs.table.documentDeleted", { defaultValue: "Документ видалено" });
  const type = t(`jobs.type.${job.job_type}`, { defaultValue: job.job_type });
  const status = t(`jobs.status.${job.status}`, { defaultValue: job.status });

  return (
    <>
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tile.cls}`}
      >
        {tile.icon}
      </span>

      <span className="block min-w-0 flex-1">
        <span className="block truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
          {title}
        </span>

        {/* One meaningful line per state */}
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
