import type { RunEvent, ChunkRef } from "../types/ai.events";
import type { RunMode, RunStatus, StepType } from "../types/ai.types";

/**
 * Folds the run event protocol into a renderable state (pure, unit-testable).
 *
 * Protocol semantics (domain/events.py):
 *  - token.delta belongs to the LAST step.started(kind=llm_call).
 *  - The final answer is the text of the last llm_call step. If that step ended with
 *    tool calls, its text is just a "comment" of the step (shown inside the step card).
 *  - Starting a new llm_call step resets the live answer buffer.
 */

export interface LiveToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: "running" | "ok" | "error";
  summary?: string;
  latencyMs?: number;
}

export interface LiveRetrieval {
  query: string;
  rewrittenQuery: string | null;
  chunks: ChunkRef[];
  reranked: boolean;
  latencyMs: number;
  warnings: string[];
}

export interface LiveStep {
  idx: number;
  kind: StepType;
  title: string;
  status: "running" | "ok" | "error";
  latencyMs?: number;
  hasToolCalls?: boolean;
  summary?: string | null;
  /** llm_call: streamed text of this step. */
  text: string;
  toolCalls: LiveToolCall[];
  retrieval?: LiveRetrieval;
}

export interface LiveCitation {
  rank: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  page: number | null;
  url: string | null;
  text: string;
}

export interface LiveRun {
  runId: string;
  /** Before run.finished arrives the status is the optimistic "running". */
  status: RunStatus;
  mode?: RunMode;
  model?: string;
  steps: LiveStep[];
  citations: LiveCitation[];
  usage?: { prompt: number; completion: number };
  messageId: string | null;
  error: { code: string | null; message: string | null } | null;
  finished: boolean;
}

export const initialLiveRun = (runId: string): LiveRun => ({
  runId,
  status: "running",
  steps: [],
  citations: [],
  messageId: null,
  error: null,
  finished: false,
});

function patchStep(
  steps: LiveStep[],
  idx: number,
  fn: (s: LiveStep) => LiveStep,
): LiveStep[] {
  const at = steps.findIndex((s) => s.idx === idx);
  if (at === -1) return steps;
  const next = steps.slice();
  next[at] = fn(steps[at]);
  return next;
}

export function reduceRunEvent(state: LiveRun, ev: RunEvent): LiveRun {
  switch (ev.type) {
    case "run.started":
      return { ...state, mode: ev.mode, model: ev.model, status: "running" };

    case "step.started": {
      if (state.steps.some((s) => s.idx === ev.idx)) return state; // replay-safe
      const step: LiveStep = {
        idx: ev.idx,
        kind: ev.kind,
        title: ev.title,
        status: "running",
        text: "",
        toolCalls: [],
      };
      return { ...state, steps: [...state.steps, step] };
    }

    case "step.finished":
      return {
        ...state,
        steps: patchStep(state.steps, ev.idx, (s) => ({
          ...s,
          status: ev.ok ? "ok" : "error",
          latencyMs: ev.latency_ms,
          hasToolCalls: ev.has_tool_calls,
          summary: ev.summary,
        })),
      };

    case "token.delta": {
      const at = lastIndexOfKind(state.steps, "llm_call");
      if (at === -1) return state;
      const steps = state.steps.slice();
      steps[at] = { ...steps[at], text: steps[at].text + ev.text };
      return { ...state, steps };
    }

    case "retrieval.done": {
      if (!state.steps.length) return state;
      const retrieval: LiveRetrieval = {
        query: ev.query,
        rewrittenQuery: ev.rewritten_query,
        chunks: ev.chunks,
        reranked: ev.reranked,
        latencyMs: ev.latency_ms,
        warnings: ev.warnings,
      };
      const preferred = lastIndexOfKind(state.steps, "retrieval");
      const at = preferred !== -1 ? preferred : state.steps.length - 1;
      const steps = state.steps.slice();
      steps[at] = { ...steps[at], retrieval };
      return { ...state, steps };
    }

    case "tool.call": {
      if (!state.steps.length) return state;
      const preferred = lastIndexOfKind(state.steps, "tool_call");
      const at = preferred !== -1 ? preferred : state.steps.length - 1;
      if (state.steps.some((s) => s.toolCalls.some((t) => t.id === ev.id)))
        return state; // replay-safe
      const call: LiveToolCall = {
        id: ev.id,
        name: ev.name,
        args: ev.args,
        status: "running",
      };
      const steps = state.steps.slice();
      steps[at] = { ...steps[at], toolCalls: [...steps[at].toolCalls, call] };
      return { ...state, steps };
    }

    case "tool.result":
      return {
        ...state,
        steps: state.steps.map((s) =>
          s.toolCalls.some((t) => t.id === ev.id)
            ? {
                ...s,
                toolCalls: s.toolCalls.map((t) =>
                  t.id === ev.id
                    ? {
                        ...t,
                        status: ev.ok ? "ok" : "error",
                        summary: ev.summary,
                        latencyMs: ev.latency_ms,
                      }
                    : t,
                ),
              }
            : s,
        ),
      };

    case "citation": {
      if (state.citations.some((c) => c.rank === ev.rank)) return state;
      const c: LiveCitation = {
        rank: ev.rank,
        chunkId: ev.chunk_id,
        documentId: ev.document_id,
        documentTitle: ev.document_title,
        page: ev.page,
        url: ev.url,
        text: ev.text,
      };
      return {
        ...state,
        citations: [...state.citations, c].sort((a, b) => a.rank - b.rank),
      };
    }

    case "usage":
      return {
        ...state,
        usage: { prompt: ev.prompt_tokens, completion: ev.completion_tokens },
      };

    case "run.finished":
      return {
        ...state,
        status: ev.status,
        messageId: ev.message_id,
        finished: true,
        usage:
          state.usage ??
          (ev.usage?.prompt_tokens !== undefined
            ? {
                prompt: ev.usage.prompt_tokens ?? 0,
                completion: ev.usage.completion_tokens ?? 0,
              }
            : undefined),
        error:
          ev.status === "failed"
            ? { code: ev.error_code, message: ev.error_message }
            : null,
      };

    default:
      return state;
  }
}

function lastIndexOfKind(steps: LiveStep[], kind: StepType): number {
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    if (steps[i].kind === kind) return i;
  }
  return -1;
}

/* ───────── selectors ───────── */

/**
 * Text to show in the answer bubble while the run is live.
 * The last llm_call step is the answer unless it ended with tool calls
 * (then it is only a step comment and the next llm_call will become the answer).
 */
export function selectLiveAnswer(run: LiveRun): string {
  const at = lastIndexOfKind(run.steps, "llm_call");
  if (at === -1) return "";
  const step = run.steps[at];
  return step.hasToolCalls ? "" : step.text;
}

/** True while the model is "thinking": the run is live and no answer text has arrived yet. */
export function selectIsThinking(run: LiveRun): boolean {
  return !run.finished && selectLiveAnswer(run).length === 0;
}

/** Index of the step shown as "in progress" in the timeline, or -1. */
export function selectActiveStepIdx(run: LiveRun): number {
  if (run.finished) return -1;
  for (let i = run.steps.length - 1; i >= 0; i -= 1) {
    if (run.steps[i].status === "running") return run.steps[i].idx;
  }
  return -1;
}

export const isRunLive = (run: LiveRun | null | undefined): boolean =>
  Boolean(run && !run.finished);
