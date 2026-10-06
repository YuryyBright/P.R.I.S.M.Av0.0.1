import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { DEFAULT_PAGE_SIZE } from "@/shared/types/api";
import { useGetJobsPageQuery } from "../api/jobs.endpoints";
import { MAX_PAGE_SIZE, POLL_INTERVAL_MS } from "../constants/jobs.constants";
import { isActiveJob, parseJobStatus } from "../lib/jobFormat";
import type { JobStatus } from "../types/job.types";

/**
 * List state lives in the URL (?page=&size=&status=), same as documents:
 * refresh, back button and shared links keep working.
 * Polls only while at least one visible job is still queued/processing.
 */
export function useJobsList() {
  const [params, setParams] = useSearchParams();

  const page = Math.max(1, Number(params.get("page")) || 1);
  const size = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(params.get("size")) || DEFAULT_PAGE_SIZE),
  );
  const status = parseJobStatus(params.get("status"));

  const patch = useCallback(
    (changes: Record<string, string | null>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(changes)) {
            if (v === null) next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  const setPage = useCallback(
    (p: number) => patch({ page: p <= 1 ? null : String(p) }),
    [patch],
  );
  const setSize = useCallback(
    (s: number) => patch({ size: String(s), page: null }),
    [patch],
  );
  const setStatus = useCallback(
    (s: JobStatus | undefined) => patch({ status: s ?? null, page: null }),
    [patch],
  );

  const [pollMs, setPollMs] = useState(0);
  const q = useGetJobsPageQuery(
    { page, size, status },
    { pollingInterval: pollMs },
  );

  const hasActive = q.data?.items.some((j) => isActiveJob(j.status)) ?? false;
  const nextPollMs = hasActive ? POLL_INTERVAL_MS : 0;
  if (nextPollMs !== pollMs) setPollMs(nextPollMs);

  const total = q.data?.total ?? 0;
  const pages = Math.ceil(total / size);

  // The last row of the last page disappeared (filter / purge) -> step back.
  useEffect(() => {
    if (q.data && !q.isFetching && total > 0 && page > pages) setPage(pages);
  }, [q.data, q.isFetching, total, page, pages, setPage]);

  return {
    rows: q.data?.items ?? [],
    page,
    size,
    status,
    total,
    pages,
    setPage,
    setSize,
    setStatus,
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    isPolling: hasActive,
    error: q.error, // NormalizedApiError | undefined
    refetch: q.refetch,
  };
}
