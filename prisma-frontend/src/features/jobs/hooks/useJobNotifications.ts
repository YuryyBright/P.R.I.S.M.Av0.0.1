import { useCallback, useMemo, useState } from "react";
import { useGetJobsPageQuery } from "../api/jobs.endpoints";
import { isActiveJob, isUnreadJob, jobEventTime } from "../lib/jobFormat";
import type { JobListItem } from "../types/job.types";

const LAST_SEEN_KEY = "jobs.notifications.lastSeenAt";
const LIMIT = 10;
const ACTIVE_POLL_MS = 3_000; // something is running -> near-live
const IDLE_POLL_MS = 30_000; // nothing running -> just catch new jobs
const EMPTY: JobListItem[] = [];

export type BellTone = "error" | "success" | "active" | null;

/** First visit: start "from now", so old history does not light up the bell. */
function readLastSeen(): number {
  try {
    const n = Number(localStorage.getItem(LAST_SEEN_KEY));
    if (Number.isFinite(n) && n > 0) return n;
    const now = Date.now();
    localStorage.setItem(LAST_SEEN_KEY, String(now));
    return now;
  } catch {
    return Date.now(); // storage blocked (private mode) — degrade gracefully
  }
}

/**
 * Feeds the header bell with real jobs.
 * - polls the first page of /jobs (3s while something is active, 30s otherwise,
 *   paused while the tab is in the background);
 * - "unread" = completed/failed jobs that finished after `lastSeenAt`
 *   (stored in localStorage; advanced with SERVER timestamps, so client clock
 *   skew cannot break it).
 * Mutations on documents/jobs already invalidate { type: "Job", id: "LIST" },
 * so the bell also refreshes right after an upload / retry / cancel.
 */
export function useJobNotifications() {
  const [lastSeenAt, setLastSeenAt] = useState(readLastSeen);
  const [hasActive, setHasActive] = useState(false);

  const q = useGetJobsPageQuery(
    { page: 1, size: LIMIT },
    {
      pollingInterval: hasActive ? ACTIVE_POLL_MS : IDLE_POLL_MS,
      skipPollingIfUnfocused: true,
    },
  );

  const rows: JobListItem[] = q.data?.items ?? EMPTY;

  // Derive during render (no effect needed): only set state when the value flips.
  const activeNow = rows.some((j) => isActiveJob(j.status));
  if (activeNow !== hasActive) setHasActive(activeNow);

  const stats = useMemo(() => {
    let active = 0;
    let failedUnread = 0;
    let doneUnread = 0;
    for (const j of rows) {
      if (isActiveJob(j.status)) active++;
      else if (isUnreadJob(j, lastSeenAt)) {
        if (j.status === "failed") failedUnread++;
        else doneUnread++;
      }
    }
    return { active, failedUnread, doneUnread };
  }, [rows, lastSeenAt]);

  const tone: BellTone =
    stats.failedUnread > 0
      ? "error"
      : stats.doneUnread > 0
        ? "success"
        : stats.active > 0
          ? "active"
          : null;

  /** Call when the dropdown closes — everything finished so far counts as seen. */
  const markSeen = useCallback(() => {
    const newest = rows.reduce((m, j) => Math.max(m, jobEventTime(j)), 0);
    if (newest <= lastSeenAt) return;
    setLastSeenAt(newest);
    try {
      localStorage.setItem(LAST_SEEN_KEY, String(newest));
    } catch {
      /* ignore */
    }
  }, [rows, lastSeenAt]);

  return {
    rows,
    activeCount: stats.active,
    failedUnread: stats.failedUnread,
    unreadCount: stats.failedUnread + stats.doneUnread,
    tone,
    isUnread: (j: JobListItem) => isUnreadJob(j, lastSeenAt),
    markSeen,
    isLoading: q.isLoading,
    error: q.error,
  };
}
