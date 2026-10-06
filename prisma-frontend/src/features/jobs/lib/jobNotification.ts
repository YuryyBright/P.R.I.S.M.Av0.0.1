import { JOBS_ROUTES } from "../constants/jobs.constants";
import type { JobListItem } from "../types/job.types";

/** Where a notification leads: the jobs list pre-filtered by that status. */
export function jobNotificationLink(job: JobListItem): string {
  return `${JOBS_ROUTES.list}?status=${job.status}`;
}
