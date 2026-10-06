import { useCallback, useMemo, useState } from "react";

import { useGetJobsPageQuery } from "../api/jobs.endpoints";
import { isActiveJob, isUnreadJob, jobEventTime } from "../lib/jobFormat";
import type { JobListItem } from "../types/job.types";

const LAST_SEEN_KEY = "jobs.notifications.lastSeenAt";
const LIMIT = 10;
const ACTIVE_POLL_MS = 3_000;
const IDLE_POLL_MS = 30_000;
const EMPTY: JobListItem[] = [];

export type BellTone = "error" | "success" | "active" | null;

/** First visit: start "from now", so old history does not light up the bell. */
function readLastSeen(): number {
  try {
    const n = Number(localStorage.getItem(LAST_SEEN_KEY));

    if (Number.isFinite(n) && n > 0) {
      return n;
    }

    const now = Date.now();
    localStorage.setItem(LAST_SEEN_KEY, String(now));

    return now;
  } catch {
    return Date.now();
  }
}

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

  const activeNow = rows.some((j) => isActiveJob(j.status));

  if (activeNow !== hasActive) {
    setHasActive(activeNow);
  }

  const stats = useMemo(() => {
    let active = 0;
    let failedUnread = 0;
    let doneUnread = 0;

    for (const j of rows) {
      if (isActiveJob(j.status)) {
        active++;
      } else if (isUnreadJob(j, lastSeenAt)) {
        if (j.status === "failed") {
          failedUnread++;
        } else {
          doneUnread++;
        }
      }
    }

    return {
      active,
      failedUnread,
      doneUnread,
    };
  }, [rows, lastSeenAt]);

  const tone: BellTone =
    stats.failedUnread > 0
      ? "error"
      : stats.doneUnread > 0
        ? "success"
        : stats.active > 0
          ? "active"
          : null;

  const markSeen = useCallback(() => {
    const newest = rows.reduce(
      (max, job) => Math.max(max, jobEventTime(job)),
      0,
    );

    if (newest <= lastSeenAt) {
      return;
    }

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
    isUnread: (job: JobListItem) => isUnreadJob(job, lastSeenAt),
    markSeen,
    isLoading: q.isLoading,
    error: q.error,
  };
}
