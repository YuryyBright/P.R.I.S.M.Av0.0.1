import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { aiApi } from "../api/ai.endpoints";
import { AI_PATHS, ACTIVE_TASK_STATUSES } from "../constants/ai.constants";
import {
  reduceTaskEvent,
  taskToLive,
  type LiveTask,
} from "../lib/taskReducer";
import { openEventStream, type SseStatus } from "../lib/sse";
import type { TaskEvent } from "../types/ai.events";
import type { Task } from "../types/ai.types";

type Action =
  | { type: "reset"; task: Task }
  | { type: "events"; events: TaskEvent[] };

function reducer(state: LiveTask, action: Action): LiveTask {
  if (action.type === "reset") return taskToLive(action.task);
  return action.events.reduce(reduceTaskEvent, state);
}

/**
 * Live projection of one task: server `Task` (source of truth) + SSE overlay.
 *
 * The stream is opened only while the task is active. When a terminal event arrives we
 * invalidate the task + artifacts cache so REST state catches up (a reload shows the same card).
 */
export function useTaskStream(task: Task | undefined): {
  live: LiveTask | null;
  connection: SseStatus | "idle";
} {
  const rtk = useDispatch();
  const [live, dispatch] = useReducer(
    reducer,
    task,
    (t): LiveTask => (t ? taskToLive(t) : (null as unknown as LiveTask)),
  );
  const [connection, setConnection] = useState<SseStatus | "idle">("idle");

  const taskId = task?.id;
  const isActive = task ? ACTIVE_TASK_STATUSES.includes(task.status) : false;
  const seededFor = useRef<string | null>(null);

  // (re)seed from the server state when the task changes, or when REST state changes while idle
  useEffect(() => {
    if (!task) return;
    if (seededFor.current !== task.id) {
      seededFor.current = task.id;
      dispatch({ type: "reset", task });
    }
  }, [task]);

  useEffect(() => {
    if (!taskId || !isActive) {
      setConnection("idle");
      return;
    }
    let done = false;

    const close = openEventStream({
      path: AI_PATHS.taskEvents(taskId),
      isDone: () => done,
      onStatus: (status) => setConnection(status),
      onMessage: (msg) => {
        let ev: TaskEvent;
        try {
          ev = JSON.parse(msg.data) as TaskEvent;
        } catch {
          return;
        }
        if (!ev || typeof ev.type !== "string") return;
        // the server may send a minimal terminal frame {task_id,status} when the stream expired
        const normalized =
          ev.type.startsWith("task.") && !("seq" in ev)
            ? ({ seq: 0, ts: new Date().toISOString(), ...(ev as object) } as TaskEvent)
            : ev;
        dispatch({ type: "events", events: [normalized] });
        if (
          normalized.type === "task.completed" ||
          normalized.type === "task.failed" ||
          normalized.type === "task.cancelled"
        ) {
          done = true;
          rtk(
            aiApi.util.invalidateTags([
              { type: "AiTask", id: taskId },
              { type: "AiTask", id: "LIST" },
              { type: "AiArtifact", id: taskId },
            ]),
          );
        }
        if (normalized.type === "task.artifact.created") {
          rtk(aiApi.util.invalidateTags([{ type: "AiArtifact", id: taskId }]));
        }
      },
    });

    return () => {
      done = true;
      close();
    };
  }, [taskId, isActive, rtk]);

  // until the reset effect ran (first render) fall back to a pure projection of the REST task
  const exposed = useMemo(
    () =>
      task
        ? live && seededFor.current === task.id
          ? live
          : taskToLive(task)
        : null,
    [task, live],
  );
  return { live: exposed, connection };
}

/** 1s ticking clock for "elapsed" counters; only runs while `enabled`. */
export function useNow(enabled: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);
  return now;
}
