import { useTranslation } from "react-i18next";
import { clampProgress, isActiveJob } from "../lib/jobFormat";
import type { JobListItem } from "../types/job.types";

const BAR: Record<string, string> = {
  failed: "bg-error-500",
  completed: "bg-success-500",
  cancelled: "bg-gray-300 dark:bg-gray-600",
};

interface Props {
  job: Pick<JobListItem, "progress" | "status" | "current_stage">;
  className?: string;
}

/** Progress bar + percentage; while running, the current pipeline stage underneath. */
export function JobProgress({ job, className = "" }: Props) {
  const { t } = useTranslation();
  const pct = job.status === "completed" ? 100 : clampProgress(job.progress);
  const active = isActiveJob(job.status);

  return (
    <div className={`min-w-36 ${className}`}>
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={t("jobs.table.columns.progress")}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${
              BAR[job.status] ?? "bg-brand-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-9 text-end text-theme-xs text-gray-500 tabular-nums dark:text-gray-400">
          {pct}%
        </span>
      </div>
      {active && job.current_stage && (
        <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
          {t(`jobs.stage.${job.current_stage}`, {
            defaultValue: job.current_stage,
          })}
        </p>
      )}
    </div>
  );
}
