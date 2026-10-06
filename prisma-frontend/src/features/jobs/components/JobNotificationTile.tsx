import type { JobStatus } from "../types/job.types";
import {
  AlertTriangleIcon,
  CheckIcon,
  QueueIcon,
  SpinnerIcon,
  StopIcon,
} from "./JobIcons";

interface Props {
  status: JobStatus;
}

export function JobNotificationTile({ status }: Props) {
  switch (status) {
    case "processing":
      return (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
          <SpinnerIcon className="size-5" />
        </span>
      );

    case "completed":
      return (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400">
          <CheckIcon className="size-5" />
        </span>
      );

    case "failed":
      return (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400">
          <AlertTriangleIcon className="size-5" />
        </span>
      );

    case "cancelled":
      return (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500">
          <StopIcon className="size-5" />
        </span>
      );

    case "queued":
    default:
      return (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400">
          <QueueIcon className="size-5" />
        </span>
      );
  }
}
