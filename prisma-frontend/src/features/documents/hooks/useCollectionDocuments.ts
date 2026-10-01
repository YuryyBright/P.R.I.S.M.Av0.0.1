import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { DEFAULT_PAGE_SIZE, type UUID } from "@/shared/types/api";
import { useGetDocumentsPageQuery } from "../api/documents.endpoints";
import { MAX_PAGE_SIZE, POLL_INTERVAL_MS } from "../constants/documents.constants";
import { isActiveStatus, parseStatus } from "../lib/documentFormat";
import type { DocumentStatus } from "../types/document.types";

/**
 * List state lives in the URL (?page=&size=&status=): refresh, back button and
 * shared links keep working. Server data stays in RTK Query.
 * Polls only while at least one visible document is still being processed.
 */
export function useCollectionDocuments(collectionId: UUID) {
  const [params, setParams] = useSearchParams();

  const page = Math.max(1, Number(params.get("page")) || 1);
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(params.get("size")) || DEFAULT_PAGE_SIZE));
  const status = parseStatus(params.get("status"));

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

  const setPage = useCallback((p: number) => patch({ page: p <= 1 ? null : String(p) }), [patch]);
  const setSize = useCallback((s: number) => patch({ size: String(s), page: null }), [patch]);
  const setStatus = useCallback(
    (s: DocumentStatus | undefined) => patch({ status: s ?? null, page: null }),
    [patch],
  );

  const [pollMs, setPollMs] = useState(0);
  const q = useGetDocumentsPageQuery(
    { collectionId, page, size, status },
    { pollingInterval: pollMs },
  );

  const hasActive = q.data?.items.some((d) => isActiveStatus(d.status)) ?? false;
  useEffect(() => setPollMs(hasActive ? POLL_INTERVAL_MS : 0), [hasActive]);

  const total = q.data?.total ?? 0;
  const pages = Math.ceil(total / size);

  // Deleted the last row of the last page -> step back instead of showing an empty page.
  useEffect(() => {
    if (q.data && !q.isFetching && total > 0 && page > pages) setPage(pages);
  }, [q.data, q.isFetching, total, page, pages, setPage]);

  return {
    rows: q.data?.items ?? [],
    page, size, status, total, pages,
    setPage, setSize, setStatus,
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    isPolling: hasActive,
    error: q.error, // NormalizedApiError | undefined
    refetch: q.refetch,
  };
}
