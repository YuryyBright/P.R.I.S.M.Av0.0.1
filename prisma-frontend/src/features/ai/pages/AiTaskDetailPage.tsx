import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { Alert } from "@/shared/ui/Alert";
import { useGetTaskArtifactsQuery, useGetTaskByIdQuery } from "../api/ai.endpoints";
import { ArrowLeftIcon, ChevronRightIcon, ClockIcon, LayersIcon } from "../components/AiIcons";
import { IconTile, Pill, focusRing, skeleton, surface } from "../components/AiUi";
import {
  ArtifactsList,
  EventLog,
  FailedItems,
  StageStepper,
} from "../components/tasks/TaskDetailParts";
import {
  Counters,
  ProgressBar,
  TaskActions,
  TaskStatusBadge,
  taskTypeLabel,
} from "../components/tasks/TaskParts";
import { AI_ROUTES, STAGE_LABELS } from "../constants/ai.constants";
import { useFitViewport } from "../hooks/useFitViewport";
import { useNow, useTaskStream } from "../hooks/useTaskStream";
import { elapsedMs, formatDuration, formatNumber } from "../lib/format";
import { formatDateTime } from "@/shared/lib/date";
import { clampPercent } from "../lib/taskReducer";
import type { StageKind } from "../types/ai.types";

const linkClass = `rounded transition-colors hover:text-gray-800 dark:hover:text-white/90 ${focusRing}`;

function Card({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className={`${surface} p-5`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** /ai/tasks/:taskId: server Task + live SSE overlay (state is rebuilt from the API on reload). */
export default function AiTaskDetailPage() {
  const { t } = useTranslation();
  const { taskId = "" } = useParams();
  const fitRef = useFitViewport<HTMLDivElement>(24);
  const { data: task, isLoading, error } = useGetTaskByIdQuery(taskId);
  const artifacts = useGetTaskArtifactsQuery(taskId, { skip: !task });
  const { live, connection } = useTaskStream(task);

  const active = Boolean(live && !live.finished);
  const now = useNow(active && live?.status === "running");

  const back = (
    <Link
      to={AI_ROUTES.tasks}
      className={`inline-flex items-center gap-1.5 text-theme-sm text-gray-500 dark:text-gray-400 ${linkClass}`}
    >
      <ArrowLeftIcon className="size-5" /> {t("ai.tasks.back", "До завдань")}
    </Link>
  );

  if (isLoading) {
    return (
      <div aria-busy="true" className="space-y-6">
        <span className="sr-only">{t("common.loading", "Завантаження…")}</span>
        <div className={`${skeleton} h-4 w-48`} />
        <div className={`${skeleton} h-36 w-full rounded-2xl`} />
        <div className={`${skeleton} h-64 w-full rounded-2xl`} />
      </div>
    );
  }
  if (error || !task || !live) {
    return (
      <div className="space-y-4">
        {back}
        <Alert>
          {(error as { message?: string } | undefined)?.message ?? t("ai.tasks.loadError", "Не вдалося завантажити завдання")}
        </Alert>
      </div>
    );
  }

  const p = live.progress;
  const elapsed = elapsedMs(task.started_at, live.finished ? task.finished_at : null, now);
  const pct = clampPercent(p);
  const stageName = live.stage ? (STAGE_LABELS[live.stage as StageKind] ?? String(live.stage)) : null;
  const artifactRows = artifacts.data ?? [];

  return (
    <div ref={fitRef} className="flex min-h-80 flex-col gap-4">
      <nav className="shrink-0" aria-label={t("common.breadcrumb", "Навігаційний ланцюжок")}>
        <ol className="flex items-center gap-1.5 text-theme-sm text-gray-500 dark:text-gray-400">
          <li className="shrink-0">
            <Link to={AI_ROUTES.tasks} className={linkClass}>
              {t("ai.tasks.title", "Завдання AI")}
            </Link>
          </li>
          <li aria-hidden="true" className="flex shrink-0 items-center">
            <ChevronRightIcon className="size-4" />
          </li>
          <li className="min-w-0">
            <span aria-current="page" className="block truncate font-medium text-gray-800 dark:text-white/90">
              {task.title}
            </span>
          </li>
        </ol>
      </nav>

      {/* header + live progress */}
      <header className={`${surface} shrink-0 space-y-4 p-4 md:p-5`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <IconTile tone="brand" className="size-12 rounded-2xl">
              <LayersIcon className="size-6" />
            </IconTile>
            <div className="min-w-0 flex-1 space-y-2.5">
              <h1 className="text-title-sm font-semibold wrap-break-word text-gray-800 dark:text-white/90">
                {task.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <TaskStatusBadge status={live.status} />
                <Pill>{taskTypeLabel(task.type)}</Pill>
                <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {t("ai.tasks.created", "Створено")} {formatDateTime(task.created_at)}
                </span>
                {connection === "retrying" && (
                  <span role="status" className="text-theme-xs text-warning-600 dark:text-warning-400">
                    {t("ai.chat.reconnecting", "З'єднання перервано, відновлюємо…")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <TaskActions taskId={task.id} status={live.status} />
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
              {stageName ?? t("ai.tasks.waiting", "Очікує запуску")}
              {live.totalStages > 0 && (
                <span className="ms-2 font-normal text-gray-500 dark:text-gray-400">
                  {t("ai.tasks.stageOf", "етап {{n}} з {{total}}", {
                    n: Math.min(live.stageIndex + 1, live.totalStages),
                    total: live.totalStages,
                  })}
                </span>
              )}
            </p>
            <p className="text-theme-sm text-gray-600 tabular-nums dark:text-gray-300">
              {p.total ? `${formatNumber(p.processed ?? 0)} / ${formatNumber(p.total)} · ${pct.toFixed(pct < 10 ? 1 : 0)}%` : ""}
            </p>
          </div>
          <ProgressBar progress={p} status={live.status} />
          {p.current_operation && active && (
            <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">{p.current_operation}</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Counters progress={p} />
            {elapsed !== null && (
              <span className="inline-flex items-center gap-1.5 text-theme-sm text-gray-600 tabular-nums dark:text-gray-300">
                <ClockIcon className="size-4" />
                {formatDuration(elapsed)}
              </span>
            )}
          </div>
          {live.lastCheckpoint !== null && active && (
            <p className="text-theme-xs text-gray-400 dark:text-gray-500">
              {t("ai.tasks.checkpoint", "Контрольна точка: оброблено {{n}}. Після збою роботу буде продовжено звідти.", {
                n: formatNumber(live.lastCheckpoint),
              })}
            </p>
          )}
        </div>

        {live.error && live.status === "failed" && <Alert>{live.error}</Alert>}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pe-1">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card title={t("ai.tasks.instruction", "Інструкція")}>
              <p className="text-theme-sm leading-6 wrap-break-word whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                {task.instruction}
              </p>
            </Card>

            <Card
              title={t("ai.tasks.artifacts", "Результати")}
              aside={
                artifactRows.length > 0 ? (
                  <Pill tone="success">{artifactRows.length}</Pill>
                ) : undefined
              }
            >
              <ArtifactsList taskId={task.id} artifacts={artifactRows} isLoading={artifacts.isLoading} />
            </Card>

            {live.failedItems.length > 0 && (
              <Card
                title={t("ai.tasks.failedItems", "Помилки обробки")}
                aside={<Pill tone="error">{live.failedItems.length}</Pill>}
              >
                <FailedItems items={live.failedItems} />
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card title={t("ai.tasks.pipeline", "Етапи")}>
              {live.stages.length || live.totalStages ? (
                <StageStepper stages={live.stages} totalStages={live.totalStages} />
              ) : (
                <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                  {t("ai.tasks.pipelineEmpty", "Етапи з'являться після запуску.")}
                </p>
              )}
            </Card>
            <Card title={t("ai.tasks.events", "Події")}>
              <EventLog entries={live.log} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
