import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ACTIVE_TASK_STATUSES, AI_ROUTES, STAGE_LABELS } from "../../constants/ai.constants";
import { useNow } from "../../hooks/useTaskStream";
import { elapsedMs, formatDuration, formatNumber, formatRelative, truncate } from "../../lib/format";
import type { StageKind, Task } from "../../types/ai.types";
import { ClockIcon, LayersIcon } from "../AiIcons";
import { IconTile, focusRing, surface } from "../AiUi";
import {
  Counters,
  ProgressBar,
  TaskActions,
  TaskStatusBadge,
  taskTypeLabel,
} from "./TaskParts";

export function TaskCard({ task }: { task: Task }) {
  const { t } = useTranslation();
  const active = ACTIVE_TASK_STATUSES.includes(task.status);
  const now = useNow(active && task.status === "running");
  const p = task.progress ?? {};
  const elapsed = elapsedMs(task.started_at, task.finished_at, now);
  const stage = task.current_stage
    ? (STAGE_LABELS[task.current_stage as StageKind] ?? task.current_stage)
    : null;
  const showProgress = active || Boolean(p.total);

  return (
    <li
      className={`${surface} group/card relative p-4 transition-all duration-200 hover:border-brand-200 hover:shadow-sm focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-500/15 sm:p-5 dark:hover:border-brand-500/30 dark:focus-within:border-brand-500/40 dark:focus-within:ring-brand-500/10`}
    >
      <div className="flex items-start gap-3">
        <IconTile className="size-10">
          <LayersIcon className="size-5" />
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              to={AI_ROUTES.taskDetail(task.id)}
              className={`min-w-0 rounded font-medium wrap-break-word text-gray-800 underline-offset-4 transition-colors hover:text-brand-500 hover:underline dark:text-white/90 dark:hover:text-brand-400 ${focusRing}`}
            >
              {task.title}
            </Link>
            <TaskStatusBadge status={task.status} />
          </div>
          <p className="mt-0.5 line-clamp-2 text-theme-xs text-gray-500 dark:text-gray-400">
            {truncate(task.instruction, 220)}
          </p>
        </div>
      </div>

      {showProgress && (
        <div className="mt-4 space-y-2.5">
          <div className="flex items-center justify-between gap-3 text-theme-xs">
            <span className="min-w-0 truncate text-gray-600 dark:text-gray-300">
              {stage
                ? `${stage}${task.total_stages ? ` · ${t("ai.tasks.stageOf", "етап {{n}} з {{total}}", { n: Math.min(task.stage_index + 1, task.total_stages), total: task.total_stages })}` : ""}`
                : t("ai.tasks.waiting", "Очікує запуску")}
            </span>
            <span className="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
              {p.total
                ? `${formatNumber(p.processed ?? 0)} / ${formatNumber(p.total)}`
                : ""}
            </span>
          </div>
          <ProgressBar progress={p} status={task.status} />
          <Counters progress={p} />
        </div>
      )}

      {task.status === "failed" && task.error && (
        <p className="mt-3 line-clamp-2 text-theme-xs text-error-600 dark:text-error-400">{task.error}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3.5 dark:border-white/5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-theme-xs text-gray-500 dark:text-gray-400">
          <span>{taskTypeLabel(task.type)}</span>
          {elapsed !== null && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <ClockIcon className="size-3.5" />
              {formatDuration(elapsed)}
            </span>
          )}
          <span>{formatRelative(task.created_at)}</span>
        </div>
        <TaskActions taskId={task.id} status={task.status} size="sm" />
      </div>
    </li>
  );
}
