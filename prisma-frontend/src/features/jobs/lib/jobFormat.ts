import {
  ACTIVE_JOB_STATUSES,
  JOB_STATUSES,
  RETRYABLE_JOB_STATUSES,
} from "../constants/jobs.constants";
import type { JobStatus } from "../types/job.types";

export const isActiveJob = (s: JobStatus): boolean =>
  ACTIVE_JOB_STATUSES.includes(s);

export const isRetryableJob = (s: JobStatus): boolean =>
  RETRYABLE_JOB_STATUSES.includes(s);

export const parseJobStatus = (v: string | null): JobStatus | undefined =>
  JOB_STATUSES.find((s) => s === v);

export const clampProgress = (n: number | null | undefined): number =>
  Math.min(100, Math.max(0, Math.round(n ?? 0)));

/**
 * Compact, locale-neutral duration: 45s · 3m 04s · 1h 02m.
 * An unfinished job is measured up to "now" (the list polls, so it keeps ticking).
 */
export function formatDuration(
  startedAt: string | null | undefined,
  finishedAt?: string | null,
): string {
  if (!startedAt) return "—";
  const start = Date.parse(startedAt);
  const end = finishedAt ? Date.parse(finishedAt) : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) return "—";

  const total = Math.max(0, Math.round((end - start) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}
