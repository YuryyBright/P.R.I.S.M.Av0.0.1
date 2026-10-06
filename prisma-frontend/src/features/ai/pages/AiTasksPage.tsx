import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Can } from "@/features/auth";
import { Alert } from "@/shared/ui/Alert";
import { btnPrimary, btnSecondary } from "@/shared/ui/classes";
import { useGetTasksQuery } from "../api/ai.endpoints";
import { LayersIcon, PlusIcon, SpinnerIcon, btnContent } from "../components/AiIcons";
import { IconTile, Segmented, skeleton, surface } from "../components/AiUi";
import { CreateTaskModal } from "../components/tasks/CreateTaskModal";
import { TaskCard } from "../components/tasks/TaskCard";
import {
  ACTIVE_TASK_STATUSES,
  AI_PERMISSIONS,
  TASKS_MAX_LIMIT,
  TASKS_PAGE_STEP,
  TASKS_POLL_MS,
} from "../constants/ai.constants";
import { aiUiActions, aiUiSlice, type TasksFilter } from "../store/aiUiSlice";

function EmptyState({ filtered }: { filtered: boolean }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  return (
    <div className={`${surface} flex flex-col items-center px-6 py-14 text-center`}>
      <IconTile className="size-12 rounded-2xl">
        <LayersIcon className="size-6" />
      </IconTile>
      <h2 className="mt-4 text-theme-sm font-medium text-gray-800 dark:text-white/90">
        {filtered ? t("ai.tasks.emptyFiltered", "Немає завдань за цим фільтром") : t("ai.tasks.empty", "Ще немає завдань")}
      </h2>
      <p className="mt-1 max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
        {t(
          "ai.tasks.emptyHint",
          "Запустіть довготривале завдання — наприклад, аналіз усіх документів колекції зі звітом.",
        )}
      </p>
      {!filtered && (
        <Can permission={AI_PERMISSIONS.tasksCreate}>
          <button
            type="button"
            className={`${btnPrimary} ${btnContent} mt-6`}
            onClick={() => dispatch(aiUiActions.openTaskCreate())}
          >
            <PlusIcon className="size-4.5" />
            {t("ai.tasks.new", "Нове завдання")}
          </button>
        </Can>
      )}
    </div>
  );
}

export default function AiTasksPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const ui = useSelector(aiUiSlice.selectors.selectAiUi);
  const [limit, setLimit] = useState(TASKS_PAGE_STEP);

  // The task list is a projection of the API: poll while anything is active (SSE only on the detail page).
  const [polling, setPolling] = useState(false);
  const q = useGetTasksQuery({ limit }, { pollingInterval: polling ? TASKS_POLL_MS : 0 });
  const rows = q.data ?? [];
  const hasActive = rows.some((x) => ACTIVE_TASK_STATUSES.includes(x.status));
  if (hasActive !== polling) setPolling(hasActive);

  const filtered = useMemo(() => {
    if (ui.tasksFilter === "active") return rows.filter((x) => ACTIVE_TASK_STATUSES.includes(x.status));
    if (ui.tasksFilter === "done") return rows.filter((x) => !ACTIVE_TASK_STATUSES.includes(x.status));
    return rows;
  }, [rows, ui.tasksFilter]);

  const activeCount = rows.filter((x) => ACTIVE_TASK_STATUSES.includes(x.status)).length;
  const canLoadMore = rows.length >= limit && limit < TASKS_MAX_LIMIT;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
            {t("ai.tasks.title", "Завдання AI")}
          </h1>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {t("ai.tasks.subtitle", "Довготривалі завдання виконуються на сервері й не залежать від відкритої вкладки.")}
          </p>
        </div>
        <Can permission={AI_PERMISSIONS.tasksCreate}>
          <button
            type="button"
            className={`${btnPrimary} ${btnContent} w-full sm:w-auto`}
            onClick={() => dispatch(aiUiActions.openTaskCreate())}
          >
            <PlusIcon className="size-4.5" />
            {t("ai.tasks.new", "Нове завдання")}
          </button>
        </Can>
      </header>

      <Can
        permission={AI_PERMISSIONS.tasksRead}
        fallback={<Alert>{t("ai.tasks.noPermission", "Недостатньо прав для перегляду завдань.")}</Alert>}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented<TasksFilter>
            label={t("ai.tasks.filter", "Фільтр")}
            value={ui.tasksFilter}
            onChange={(f) => dispatch(aiUiActions.setTasksFilter(f))}
            options={[
              { value: "all", label: t("ai.tasks.filterAll", "Усі") },
              {
                value: "active",
                label: `${t("ai.tasks.filterActive", "Активні")}${activeCount ? ` · ${activeCount}` : ""}`,
              },
              { value: "done", label: t("ai.tasks.filterDone", "Завершені") },
            ]}
          />
          {q.isFetching && !q.isLoading && (
            <span className="inline-flex items-center gap-2 text-theme-xs text-gray-400" role="status">
              <SpinnerIcon className="size-3.5" />
              {t("ai.tasks.updating", "Оновлення…")}
            </span>
          )}
        </div>

        {q.error && (
          <Alert>
            {(q.error as { message?: string }).message ?? t("ai.tasks.loadError", "Не вдалося завантажити завдання")}
          </Alert>
        )}

        {q.isLoading ? (
          <ul aria-busy="true" className="grid gap-4 lg:grid-cols-2">
            <span className="sr-only">{t("common.loading", "Завантаження…")}</span>
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className={`${surface} space-y-4 p-5`}>
                <div className="flex items-center gap-3">
                  <div className={`${skeleton} size-10 rounded-xl`} />
                  <div className="flex-1 space-y-2">
                    <div className={`${skeleton} h-3.5 w-2/3`} />
                    <div className={`${skeleton} h-3 w-full`} />
                  </div>
                </div>
                <div className={`${skeleton} h-2 w-full rounded-full`} />
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <EmptyState filtered={ui.tasksFilter !== "all" && rows.length > 0} />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {filtered.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </ul>
        )}

        {canLoadMore && !q.isLoading && (
          <div className="flex justify-center">
            <button
              type="button"
              className={`${btnSecondary} ${btnContent}`}
              disabled={q.isFetching}
              onClick={() => setLimit((l) => Math.min(l + TASKS_PAGE_STEP, TASKS_MAX_LIMIT))}
            >
              {q.isFetching && <SpinnerIcon className="size-4" />}
              {t("ai.tasks.more", "Показати ще")}
            </button>
          </div>
        )}
      </Can>

      {ui.taskCreateOpen && <CreateTaskModal onClose={() => dispatch(aiUiActions.closeTaskCreate())} />}
    </div>
  );
}
