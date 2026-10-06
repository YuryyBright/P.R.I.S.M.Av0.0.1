import { useEffect, useReducer, useRef, useState } from "react";
import { AI_PATHS } from "../constants/ai.constants";
import {
  initialLiveRun,
  reduceRunEvent,
  type LiveRun,
} from "../lib/runReducer";
import { openEventStream, type SseStatus } from "../lib/sse";
import type { RunEvent } from "../types/ai.events";

type Action =
  | { type: "reset"; runId: string }
  | { type: "events"; events: RunEvent[] };

function reducer(state: LiveRun | null, action: Action): LiveRun | null {
  if (action.type === "reset") return initialLiveRun(action.runId);
  if (!state) return state;
  return action.events.reduce(reduceRunEvent, state);
}

export interface RunStreamState {
  run: LiveRun | null;
  connection: SseStatus | "idle";
  /** Set when the stream gave up (401/403/404): the UI should offer a reload. */
  streamError: string | null;
}

/**
 * Subscribes to GET /ai/runs/{id}/events and folds events into a LiveRun.
 *
 * - The Redis stream is replayed from the start on (re)mount, and from the last id on reconnect,
 *   so the state is always rebuilt from the backend — never persisted client-side.
 * - Tokens arrive very fast: events are queued and applied once per animation frame.
 * - `onFinished` fires exactly once per run, after the terminal state was applied.
 */
export function useRunStream(
  runId: string | null,
  onFinished?: (run: LiveRun) => void,
): RunStreamState {
  const [run, dispatch] = useReducer(reducer, null);
  const [connection, setConnection] = useState<SseStatus | "idle">("idle");
  const [streamError, setStreamError] = useState<string | null>(null);

  const finishedCb = useRef(onFinished);
  finishedCb.current = onFinished;
  const firedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!runId) {
      setConnection("idle");
      setStreamError(null);
      return;
    }

    dispatch({ type: "reset", runId });
    setStreamError(null);
    firedFor.current = null;

    let done = false;
    let queue: RunEvent[] = [];
    let frame: number | null = null;

    const flush = () => {
      frame = null;
      if (!queue.length) return;
      const batch = queue;
      queue = [];
      dispatch({ type: "events", events: batch });
    };
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(flush);
    };

    const close = openEventStream({
      path: AI_PATHS.runEvents(runId),
      isDone: () => done,
      onStatus: (status, err) => {
        setConnection(status);
        if (status === "closed" && err) setStreamError(err.message);
      },
      onMessage: (msg) => {
        let ev: RunEvent;
        try {
          ev = JSON.parse(msg.data) as RunEvent;
        } catch {
          return; // malformed frame: skip, never crash the chat
        }
        if (!ev || typeof ev.type !== "string") return;
        queue.push(ev);
        if (ev.type === "run.finished") done = true;
        schedule();
      },
    });

    return () => {
      done = true;
      close();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [runId]);

  // fire onFinished once, after the finished state was rendered into `run`
  useEffect(() => {
    if (run?.finished && firedFor.current !== run.runId) {
      firedFor.current = run.runId;
      finishedCb.current?.(run);
    }
  }, [run]);

  // never expose the previous run for one render while the new one is being reset
  return {
    run: runId && run?.runId === runId ? run : null,
    connection,
    streamError,
  };
}
