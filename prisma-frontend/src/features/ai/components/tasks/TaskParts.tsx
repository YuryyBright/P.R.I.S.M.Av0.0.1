import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Can } from "@/features/auth";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import {
  useCancelTaskMutation,
  useResumeTaskMutation,
} from "../../api/ai.endpoints";
import {
  AI_PERMISSIONS,
  RESUMABLE_TASK_STATUSES,
  STOPPABLE_TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_TYPE_OPTIONS,
} from "../../constants/ai.constants";
import { formatNumber } from "../../lib/format";
import { clampPercent } from "../../lib/taskReducer";
import type {
  TaskProgressData,
  TaskStatus,
  TaskType,
} from "../../types/ai.types";
import { PlayIcon, SpinnerIcon, StopIcon, btnContent } from "../AiIcons";
import { focusRing, Pill } from "../AiUi";

const STATUS_TONE: Record<TaskStatus, "neutral" | "brand" | "success" | "warning" | "error"> = {
  queued: "neutral",
  running: "brand",
  paused: "warning",
  cancelling: "warning",
  cancelled: "neutral",
  failed: "error",
  completed: "success",
  waiting_for_input: "warning",
  waiting_for_tool: "warning",
};
const DOT: Record<string, string> = {
  neutral: "bg-gray-400 dark:bg-gray-500",
  brand: "bg-brand-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  error: "bg-error-500",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { t } = useTranslation();
  const tone = STATUS_TONE[status] ?? "neutral";
  const pulse = status === "running" || status === "cancelling";
  return (
    <Pill tone={tone}>
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${DOT[tone]} ${pulse ? "animate-pulse motion-reduce:animate-none" : ""}`}
      />
      {t(`ai.tasks.status.${status}`, TASK_STATUS_LABELS[status] ?? status)}
    </Pill>
  );
}

export const taskTypeLabel = (type: TaskType): string =>
  TASK_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;

interface BarProps {
  progress: TaskProgressData | undefined;
  status: TaskStatus;
  className?: string;
}

/** Determinate when the total is known, indeterminate shimmer while a task is active without numbers. */
export function ProgressBar({ progress, status, className = "" }: BarProps) {
  const { t } = useTranslation();
  const pct = clampPercent(progress);
  const active = ["queued", "running", "waiting_for_input", "waiting_for_tool", "cancelling"].includes(status);
  const indeterminate = active && !progress?.total;
  const fill =
    status === "failed"
      ? "bg-error-500"
      : status === "completed"
        ? "bg-success-500"
        : status === "cancelled" || status === "paused" || status === "cancelling"
          ? "bg-warning-500"
          : "bg-brand-500";

  return (
    <div
      role="progressbar"
      aria-label={t("ai.tasks.progress", "Прогрес")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(pct)}
      className={`h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10 ${className}`}
    >
      {indeterminate ? (
        <div className="h-full w-1/3 animate-pulse rounded-full bg-brand-500/60 motion-reduce:animate-none" />
      ) : (
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${fill}`}
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  );
}

export function Counters({ progress }: { progress: TaskProgressData | undefined }) {
  const { t } = useTranslation();
  const p = progress ?? {};
  const items = [
    { k: "ok", label: t("ai.tasks.successful", "Успішно"), v: p.successful, tone: "text-success-600 dark:text-success-400" },
    { k: "fail", label: t("ai.tasks.failed", "Помилок"), v: p.failed, tone: (p.failed ?? 0) > 0 ? "text-error-600 dark:text-error-400" : "" },
    { k: "skip", label: t("ai.tasks.skipped", "Пропущено"), v: p.skipped, tone: "" },
  ];
  return (
    <dl className="flex flex-wrap gap-x-5 gap-y-1">
      {items.map((i) => (
        <div key={i.k} className="flex items-baseline gap-1.5">
          <dt className="text-theme-xs text-gray-500 dark:text-gray-400">{i.label}</dt>
          <dd className={`text-theme-sm font-medium tabular-nums text-gray-800 dark:text-white/90 ${i.tone}`}>
            {formatNumber(i.v ?? 0)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface ActionsProps {
  taskId: string;
  status: TaskStatus;
  /** "icon" for dense cards, "labeled" for the detail header. */
  size?: "sm" | "md";
}

/** Stop / Resume, gated by `ai.tasks.manage` and by what the backend lifecycle allows. */
export function TaskActions({ taskId, status, size = "md" }: ActionsProps) {
  const { t } = useTranslation();
  const [cancel, cancelS] = useCancelTaskMutation();
  const [resume, resumeS] = useResumeTaskMutation();
  const [error, setError] = useState<string | null>(null);

  const canStop = STOPPABLE_TASK_STATUSES.includes(status);
  const canResume = RESUMABLE_TASK_STATUSES.includes(status);
  if (!canStop && !canResume) return null;

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(isNormalizedApiError(e) ? e.message : t("errors.unexpected", "Сталася неочікувана помилка"));
    }
  }

  const h = size === "sm" ? "h-9" : "h-10";
  const base = `${btnContent} ${h} rounded-lg border px-3 text-theme-sm font-medium shadow-xs transition-colors disabled:pointer-events-none disabled:opacity-50 ${focusRing}`;

  return (
    <Can permission={AI_PERMISSIONS.tasksManage}>
      <div className="space-y-2">
        <div className="flex gap-2">
          {canStop && (
            <button
              type="button"
              disabled={cancelS.isLoading}
              onClick={() => run(() => cancel(taskId).unwrap())}
              className={`${base} border-gray-200 bg-white text-error-600 hover:border-error-200 hover:bg-error-50 dark:border-white/10 dark:bg-white/3 dark:text-error-400 dark:hover:border-error-500/30 dark:hover:bg-error-500/10`}
            >
              {cancelS.isLoading ? <SpinnerIcon className="size-4" /> : <StopIcon className="size-3.5" />}
              {t("ai.tasks.stop", "Зупинити")}
            </button>
          )}
          {canResume && (
            <button
              type="button"
              disabled={resumeS.isLoading}
              onClick={() => run(() => resume(taskId).unwrap())}
              className={`${base} border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:bg-white/3 dark:text-gray-300 dark:hover:bg-white/6`}
            >
              {resumeS.isLoading ? <SpinnerIcon className="size-4" /> : <PlayIcon className="size-3.5" />}
              {t("ai.tasks.resume", "Відновити")}
            </button>
          )}
        </div>
        {error && <Alert>{error}</Alert>}
      </div>
    </Can>
  );
}
