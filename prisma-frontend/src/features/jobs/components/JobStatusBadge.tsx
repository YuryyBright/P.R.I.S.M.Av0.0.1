import { useTranslation } from "react-i18next";
import { isActiveJob } from "../lib/jobFormat";
import type { JobStatus } from "../types/job.types";

const base =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-theme-xs font-medium whitespace-nowrap";

interface Tone {
  badge: string;
  dot: string;
}

const NEUTRAL: Tone = {
  badge: "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300",
  dot: "bg-gray-400 dark:bg-gray-500",
};
const ACTIVE: Tone = {
  badge: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
  dot: "bg-brand-500",
};
const SUCCESS: Tone = {
  badge:
    "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
  dot: "bg-success-500",
};
const ERROR: Tone = {
  badge: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400",
  dot: "bg-error-500",
};
const MUTED: Tone = {
  badge: "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
  dot: "bg-gray-300 dark:bg-gray-600",
};

const TONES: Record<JobStatus, Tone> = {
  queued: NEUTRAL,
  processing: ACTIVE,
  completed: SUCCESS,
  failed: ERROR,
  cancelled: MUTED,
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const { t } = useTranslation();
  // Unknown / differently-cased API values must not crash the list.
  const key = String(status ?? "")
    .trim()
    .toLowerCase() as JobStatus;
  const tone = TONES[key] ?? NEUTRAL;
  return (
    <span className={`${base} ${tone.badge}`}>
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${tone.dot} ${
          isActiveJob(key) ? "animate-pulse motion-reduce:animate-none" : ""
        }`}
      />
      {t(`jobs.status.${key}`, { defaultValue: key || "—" })}
    </span>
  );
}
