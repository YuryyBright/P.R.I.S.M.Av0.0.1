import { DOCUMENT_PERMISSIONS } from "@/features/documents";
import type { JobStatus, StageName } from "../types/job.types";

/** Paths are relative to API_BASE_URL. Router prefix "/jobs" is assumed. */
export const JOBS_PATHS = {
  root: "/jobs",
  byId: (id: string) => `/jobs/${id}`,
  cancel: (id: string) => `/jobs/${id}/cancel`,
  retry: (id: string) => `/jobs/${id}/retry`,
} as const;

/** Browser routes owned by this feature. */
export const JOBS_ROUTES = {
  list: "/jobs",
} as const;

/**
 * Jobs reuse the documents permissions: jobs.py guards its routes with
 * PERM_DOCUMENTS_READ (GET) and PERM_DOCUMENTS_WRITE (cancel / retry).
 */
export const JOB_PERMISSIONS = {
  read: DOCUMENT_PERMISSIONS.read,
  write: DOCUMENT_PERMISSIONS.write,
} as const;

export const JOB_STATUSES: JobStatus[] = [
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
];

/** A worker is (or will be) busy with it -> keep polling, allow cancel. */
export const ACTIVE_JOB_STATUSES: readonly JobStatus[] = ["queued", "processing"];

/** Mirrors JobService.ensure_retryable. */
export const RETRYABLE_JOB_STATUSES: readonly JobStatus[] = ["failed", "cancelled"];

/** Pipeline order (tasks.py: PARSE → CHUNK → EMBED(+INDEX) → FINALIZE). */
export const STAGE_ORDER: StageName[] = [
  "parse",
  "chunk",
  "embed",
  "index",
  "finalize",
];

export const POLL_INTERVAL_MS = 3000;
export const MAX_PAGE_SIZE = 100; // backend: Query(le=100)
