import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/shared/ui/Alert";
import { AI_PATHS, STAGE_LABELS } from "../../constants/ai.constants";
import { formatBytes, formatTime, truncate } from "../../lib/format";
import { fetchBlob } from "../../lib/sse";
import type {
  TaskFailedItem,
  TaskLogEntry,
  TaskStageState,
} from "../../lib/taskReducer";
import type { StageKind, TaskArtifact } from "../../types/ai.types";
import {
  AlertTriangleIcon,
  CheckIcon,
  DownloadIcon,
  FileIcon,
  SpinnerIcon,
} from "../AiIcons";
import { focusRing, IconTile } from "../AiUi";

/* ───────── pipeline stepper ───────── */

export function StageStepper({
  stages,
  totalStages,
}: {
  stages: TaskStageState[];
  totalStages: number;
}) {
  const { t } = useTranslation();
  // pipeline length is known, names only as stages start: pad with anonymous pending steps
  const pending = Math.max(0, totalStages - stages.length);
  if (!stages.length && !pending) return null;

  return (
    <ol aria-label={t("ai.tasks.pipeline", "Етапи")} className="space-y-0">
      {stages.map((s, i) => {
        const last = i === stages.length - 1 && pending === 0;
        return (
          <li key={s.stage} className="relative flex gap-3">
            {!last && (
              <span
                aria-hidden="true"
                className={`absolute start-3 top-7 -bottom-1 w-px ${s.state === "done" ? "bg-success-300 dark:bg-success-500/40" : "bg-gray-200 dark:bg-white/10"}`}
              />
            )}
            <span
              className={`z-10 flex size-6 shrink-0 items-center justify-center rounded-full ${
                s.state === "done"
                  ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400"
                  : s.state === "active"
                    ? "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400"
                    : "bg-gray-100 text-gray-400 dark:bg-white/5"
              }`}
            >
              {s.state === "done" ? (
                <CheckIcon className="size-3.5" />
              ) : s.state === "active" ? (
                <SpinnerIcon className="size-3.5" />
              ) : (
                <span className="size-1.5 rounded-full bg-current" />
              )}
            </span>
            <div className="pb-4">
              <p
                className={`text-theme-sm ${
                  s.state === "pending"
                    ? "text-gray-400 dark:text-gray-500"
                    : "font-medium text-gray-800 dark:text-white/90"
                }`}
              >
                {t(
                  `ai.tasks.stage.${s.stage}`,
                  STAGE_LABELS[s.stage as StageKind] ?? s.stage,
                )}
              </p>
            </div>
          </li>
        );
      })}
      {pending > 0 && (
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/5">
            <span className="size-1.5 rounded-full bg-current" />
          </span>
          <p className="text-theme-sm text-gray-400 dark:text-gray-500">
            {t("ai.tasks.moreStages", "Ще етапів: {count}", { count: pending })}
          </p>
        </li>
      )}
    </ol>
  );
}

/* ───────── failed items ───────── */

export function FailedItems({ items }: { items: TaskFailedItem[] }) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const shown = all ? items : items.slice(-5);
  return (
    <div>
      <ul className="divide-y divide-gray-100 dark:divide-white/5">
        {shown.map((f, i) => (
          <li key={`${f.key}-${i}`} className="flex gap-3 py-2.5">
            <AlertTriangleIcon className="mt-0.5 size-4 text-error-500" />
            <div className="min-w-0">
              <p className="font-mono truncate text-theme-xs font-medium text-gray-800 dark:text-white/90">
                {f.key}
              </p>
              <p className="text-theme-xs wrap-break-word text-gray-500 dark:text-gray-400">
                {truncate(f.error, 300)}
                <span className="ms-2 text-gray-400">
                  {t("ai.tasks.attempt", "спроба {{n}}", { n: f.attempt })}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ul>
      {items.length > 5 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className={`mt-1 rounded text-theme-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 ${focusRing}`}
        >
          {all
            ? t("ai.timeline.less", "Згорнути")
            : t("ai.tasks.showAllFailed", "Показати всі ({count})", {
                count: items.length,
              })}
        </button>
      )}
    </div>
  );
}

/* ───────── event log ───────── */

const LOG_DOT: Record<TaskLogEntry["tone"], string> = {
  info: "bg-gray-300 dark:bg-gray-600",
  success: "bg-success-500",
  warning: "bg-warning-500",
  error: "bg-error-500",
};

export function EventLog({ entries }: { entries: TaskLogEntry[] }) {
  const { t } = useTranslation();
  if (!entries.length)
    return (
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">
        {t("ai.tasks.noEvents", "Подій поки немає.")}
      </p>
    );
  return (
    <ol className="max-h-72 space-y-2 overflow-y-auto pe-1">
      {[...entries].reverse().map((e) => (
        <li key={e.key} className="flex items-start gap-2.5">
          <span
            aria-hidden="true"
            className={`mt-1.5 size-1.5 shrink-0 rounded-full ${LOG_DOT[e.tone]}`}
          />
          <p className="min-w-0 flex-1 text-theme-sm wrap-break-word text-gray-700 dark:text-gray-300">
            {e.text}
          </p>
          <time
            className="shrink-0 text-theme-xs text-gray-400 tabular-nums dark:text-gray-500"
            dateTime={e.ts}
          >
            {formatTime(e.ts)}
          </time>
        </li>
      ))}
    </ol>
  );
}

/* ───────── artifacts ───────── */

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ArtifactsList({
  taskId,
  artifacts,
  isLoading,
}: {
  taskId: string;
  artifacts: TaskArtifact[];
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(a: TaskArtifact) {
    setBusy(a.id);
    setError(null);
    try {
      const { blob, filename } = await fetchBlob(
        AI_PATHS.taskArtifactDownload(taskId, a.id),
      );
      saveBlob(blob, filename ?? a.name);
    } catch (e) {
      setError(
        e instanceof Error &&
          "status" in e &&
          (e as { status: number }).status === 404
          ? t(
              "ai.tasks.downloadMissing",
              "Завантаження недоступне: на сервері немає endpoint для файлів завдання.",
            )
          : e instanceof Error
            ? e.message
            : t("errors.unexpected", "Сталася неочікувана помилка"),
      );
    } finally {
      setBusy(null);
    }
  }

  if (isLoading)
    return (
      <p className="inline-flex items-center gap-2 text-theme-sm text-gray-500">
        <SpinnerIcon className="size-4" />{" "}
        {t("common.loading", "Завантаження…")}
      </p>
    );
  if (!artifacts.length)
    return (
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">
        {t(
          "ai.tasks.noArtifacts",
          "Файли з'являться після завершення завдання.",
        )}
      </p>
    );

  return (
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      <ul className="space-y-2">
        {artifacts.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-white/10"
          >
            <IconTile className="size-9">
              <FileIcon className="size-4.5" />
            </IconTile>
            <div className="min-w-0 flex-1">
              <p className="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
                {a.name}
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                {a.type.toUpperCase()} · {formatBytes(a.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void download(a)}
              disabled={busy === a.id}
              aria-label={`${t("ai.tasks.download", "Завантажити")}: ${a.name}`}
              className={`inline-flex size-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white/90 ${focusRing}`}
            >
              {busy === a.id ? (
                <SpinnerIcon className="size-4.5" />
              ) : (
                <DownloadIcon className="size-4.5" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
