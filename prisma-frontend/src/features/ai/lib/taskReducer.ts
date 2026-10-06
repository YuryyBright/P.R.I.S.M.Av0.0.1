import { STAGE_LABELS } from "../constants/ai.constants";
import type { TaskEvent } from "../types/ai.events";
import type {
  StageKind,
  Task,
  TaskProgressData,
  TaskStatus,
} from "../types/ai.types";

/**
 * Task state = projection of the API (docs/FRONTEND_INTEGRATION.md):
 * the server Task is the source of truth; SSE events are overlaid on top of it
 * and a page reload rebuilds the same card from `GET /ai/tasks/{id}`.
 */

export interface TaskFailedItem {
  key: string;
  error: string;
  attempt: number;
  ts: string;
}
export interface TaskLogEntry {
  key: string;
  ts: string;
  tone: "info" | "success" | "warning" | "error";
  text: string;
}
export interface TaskStageState {
  stage: StageKind;
  state: "pending" | "active" | "done";
}

export interface LiveTask {
  status: TaskStatus;
  progress: TaskProgressData;
  stage: StageKind | string | null;
  stageIndex: number;
  totalStages: number;
  /** Stages in the order we've seen them (the backend does not publish the full pipeline up front). */
  stages: TaskStageState[];
  failedItems: TaskFailedItem[];
  artifactsCreated: { id: string; name: string }[];
  log: TaskLogEntry[];
  lastCheckpoint: number | null;
  error: string | null;
  finished: boolean;
}

const MAX_LOG = 60;
const MAX_FAILED = 200;

export function taskToLive(task: Task): LiveTask {
  const stage = task.current_stage;
  return {
    status: task.status,
    progress: task.progress ?? {},
    stage,
    stageIndex: task.stage_index,
    totalStages: task.total_stages,
    stages: stage
      ? [{ stage: stage as StageKind, state: "active" }]
      : [],
    failedItems: [],
    artifactsCreated: [],
    log: [],
    lastCheckpoint: null,
    error: task.error,
    finished: ["completed", "failed", "cancelled"].includes(task.status),
  };
}

function markStage(
  stages: TaskStageState[],
  stage: StageKind,
  state: TaskStageState["state"],
): TaskStageState[] {
  const exists = stages.some((s) => s.stage === stage);
  const next = exists
    ? stages.map((s) => (s.stage === stage ? { ...s, state } : s))
    : [...stages, { stage, state }];
  // a stage that starts means earlier "active" ones are done
  return state === "active"
    ? next.map((s) =>
        s.stage !== stage && s.state === "active" ? { ...s, state: "done" } : s,
      )
    : next;
}

const stageLabel = (s: string) => STAGE_LABELS[s as StageKind] ?? s;

function pushLog(state: LiveTask, entry: Omit<TaskLogEntry, "key">, seq: number): LiveTask {
  const log = [...state.log, { ...entry, key: `${seq}-${state.log.length}` }];
  return { ...state, log: log.slice(-MAX_LOG) };
}

export function reduceTaskEvent(state: LiveTask, ev: TaskEvent): LiveTask {
  switch (ev.type) {
    case "task.created":
      return state;

    case "task.started":
      return pushLog(
        { ...state, status: "running" },
        { ts: ev.ts, tone: "info", text: "Завдання запущено" },
        ev.seq,
      );

    case "task.stage.started":
      return pushLog(
        {
          ...state,
          status: state.status === "cancelling" ? state.status : "running",
          stage: ev.stage,
          stageIndex: ev.stage_index,
          totalStages: ev.total_stages,
          stages: markStage(state.stages, ev.stage, "active"),
        },
        {
          ts: ev.ts,
          tone: "info",
          text: `Етап ${ev.stage_index + 1}/${ev.total_stages}: ${stageLabel(ev.stage)}`,
        },
        ev.seq,
      );

    case "task.stage.completed":
      return {
        ...state,
        stageIndex: ev.stage_index,
        totalStages: ev.total_stages,
        stages: markStage(state.stages, ev.stage, "done"),
      };

    case "task.progress":
      return {
        ...state,
        stage: ev.stage ?? state.stage,
        progress: {
          stage: ev.stage ?? state.progress.stage,
          processed: ev.processed,
          total: ev.total,
          percent: ev.percent,
          successful: ev.successful,
          failed: ev.failed,
          skipped: ev.skipped,
          current_operation: ev.current_operation,
        },
      };

    case "task.item.failed": {
      const failedItems = [
        ...state.failedItems,
        { key: ev.item_key, error: ev.error, attempt: ev.attempt, ts: ev.ts },
      ].slice(-MAX_FAILED);
      return { ...state, failedItems };
    }

    case "task.checkpoint.saved":
      return { ...state, lastCheckpoint: ev.processed };

    case "task.artifact.created":
      return pushLog(
        {
          ...state,
          artifactsCreated: [
            ...state.artifactsCreated,
            { id: ev.artifact_id, name: ev.name },
          ],
        },
        { ts: ev.ts, tone: "success", text: `Створено файл: ${ev.name}` },
        ev.seq,
      );

    case "task.cancel.requested":
      return pushLog(
        { ...state, status: "cancelling" },
        { ts: ev.ts, tone: "warning", text: "Запит на зупинку надіслано" },
        ev.seq,
      );

    case "task.completed":
    case "task.failed":
    case "task.cancelled": {
      const tone =
        ev.type === "task.completed"
          ? "success"
          : ev.type === "task.failed"
            ? "error"
            : "warning";
      const text =
        ev.type === "task.completed"
          ? "Завдання завершено"
          : ev.type === "task.failed"
            ? "Завдання завершилось помилкою"
            : "Завдання скасовано";
      return pushLog(
        {
          ...state,
          status: ev.status,
          finished: true,
          error: ev.error_message ?? state.error,
          stages: state.stages.map((s) =>
            s.state === "active" && ev.type === "task.completed"
              ? { ...s, state: "done" }
              : s,
          ),
        },
        { ts: ev.ts, tone, text: ev.error_message ? `${text}: ${ev.error_message}` : text },
        ev.seq,
      );
    }

    default:
      return state;
  }
}

/* ───────── helpers ───────── */

export function clampPercent(p: TaskProgressData | undefined): number {
  if (!p) return 0;
  if (typeof p.percent === "number") return Math.max(0, Math.min(100, p.percent));
  if (p.total && p.processed !== undefined)
    return Math.max(0, Math.min(100, (p.processed / p.total) * 100));
  return 0;
}
