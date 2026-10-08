import {
  ACTIVE_JOB_STATUSES,
  JOB_STATUSES,
  RETRYABLE_JOB_STATUSES,
} from "../constants/jobs.constants";
import type { JobStatus, JobType } from "../types/job.types";

/**
 * The API may send naive timestamps ("2026-10-06T10:00:00", no "Z"/offset) that
 * are really UTC. `Date.parse` would treat them as LOCAL time and everything is
 * shifted by the UTC offset. Add "Z" when no zone is present.
 */
const HAS_ZONE = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

export function normalizeServerDate<T extends string | null | undefined>(
  v: T,
): T {
  if (typeof v !== "string" || !v) return v;

  const iso = v.includes(" ") ? v.replace(" ", "T") : v;

  // Date-only strings (no "T") are left alone.
  if (!iso.includes("T") || HAS_ZONE.test(iso)) return iso as T;

  return `${iso}Z` as T;
}

export const isActiveJob = (s: JobStatus): boolean =>
  ACTIVE_JOB_STATUSES.includes(s);

export const isRetryableJob = (s: JobStatus): boolean =>
  RETRYABLE_JOB_STATUSES.includes(s);

export const parseJobStatus = (v: string | null): JobStatus | undefined =>
  JOB_STATUSES.find((s) => s === v);

export const jobTypeLabel = (type: JobType): string => {
  const labels: Record<JobType, string> = {
    document_ingest: "Document ingestion",
    source_sync: "Source sync",
    reindex: "Reindex",
    cleanup: "Cleanup",
  };
  return labels[type];
};

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

  const start = Date.parse(normalizeServerDate(startedAt));
  const end = finishedAt
    ? Date.parse(normalizeServerDate(finishedAt))
    : Date.now();

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

/**
 * Moment the job was created.
 *
 * Notifications use the same reference point as the job creation time,
 * so the relative time stays consistent with the timestamp shown in the
 * jobs list.
 */
export function jobEventTime(job: { created_at: string }): number {
  const t = Date.parse(normalizeServerDate(job.created_at));

  return Number.isNaN(t) ? 0 : t;
}

/**
 * A finished (completed / failed) job the user has not "seen" in the bell yet.
 */
export function isUnreadJob(
  job: {
    status: JobStatus;
    created_at: string;
  },
  lastSeenAt: number,
): boolean {
  return (
    (job.status === "completed" || job.status === "failed") &&
    jobEventTime(job) > lastSeenAt
  );
}

export type RelativeUnit = "now" | "min" | "hr" | "day";

/**
 * Coarse "5 min ago" parts; the component maps them to i18n keys.
 */
export function relativeTimeParts(
  time: number,
  now: number = Date.now(),
): { unit: RelativeUnit; count: number } {
  const diffMin = Math.max(0, Math.floor((now - time) / 60000));

  if (diffMin < 1) return { unit: "now", count: 0 };

  if (diffMin < 60) {
    return { unit: "min", count: diffMin };
  }

  const hrs = Math.floor(diffMin / 60);

  if (hrs < 24) {
    return { unit: "hr", count: hrs };
  }

  return {
    unit: "day",
    count: Math.floor(hrs / 24),
  };
}
