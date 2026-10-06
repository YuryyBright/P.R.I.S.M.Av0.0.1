import type { UUID } from "@/shared/types/api";
import type {
  RunMode,
  RunStatus,
  StageKind,
  StepType,
  TaskStatus,
} from "./ai.types";

/* =====================================================================
 * RUN EVENTS  (app/ai/domain/events.py, docs/run-events.schema.json)
 * SSE envelope: id = Redis Stream id, event = type, data = JSON.
 * token.delta belongs to the LAST step.started(kind=llm_call).
 * ===================================================================== */

interface BaseEvent {
  run_id?: UUID | null;
  seq: number;
  ts: string;
}

export interface ChunkRef {
  n: number;
  chunk_id: UUID;
  document_id: UUID;
  document_title: string;
  page: number | null;
  score: number;
  rerank_score: number | null;
  preview: string;
}

export type RunEvent =
  | (BaseEvent & {
      type: "run.started";
      mode: RunMode;
      model: string;
      config: Record<string, unknown>;
    })
  | (BaseEvent & {
      type: "step.started";
      idx: number;
      kind: StepType;
      title: string;
    })
  | (BaseEvent & {
      type: "step.finished";
      idx: number;
      kind: StepType;
      ok: boolean;
      latency_ms: number;
      has_tool_calls: boolean;
      summary: string | null;
    })
  | (BaseEvent & { type: "token.delta"; text: string })
  | (BaseEvent & {
      type: "retrieval.done";
      query: string;
      rewritten_query: string | null;
      chunks: ChunkRef[];
      reranked: boolean;
      latency_ms: number;
      warnings: string[];
    })
  | (BaseEvent & {
      type: "tool.call";
      id: string;
      name: string;
      args: Record<string, unknown>;
    })
  | (BaseEvent & {
      type: "tool.result";
      id: string;
      ok: boolean;
      summary: string;
      latency_ms: number;
    })
  | (BaseEvent & {
      type: "citation";
      rank: number;
      chunk_id: UUID;
      document_id: UUID;
      document_title: string;
      page: number | null;
      url: string | null;
      text: string;
    })
  | (BaseEvent & {
      type: "usage";
      prompt_tokens: number;
      completion_tokens: number;
    })
  | (BaseEvent & {
      type: "run.finished";
      status: RunStatus;
      message_id: UUID | null;
      finish_reason: string | null;
      error_code: string | null;
      error_message: string | null;
      usage: Record<string, number>;
    });

/* =====================================================================
 * TASK EVENTS  (app/ai/tasks/events.py)
 * ===================================================================== */

interface BaseTaskEvent {
  task_id: UUID;
  seq: number;
  ts: string;
}

export type TaskEvent =
  | (BaseTaskEvent & { type: "task.created" })
  | (BaseTaskEvent & { type: "task.started" })
  | (BaseTaskEvent & {
      type: "task.stage.started";
      stage: StageKind;
      stage_index: number;
      total_stages: number;
    })
  | (BaseTaskEvent & {
      type: "task.progress";
      stage: StageKind | null;
      processed: number;
      total: number;
      percent: number;
      successful: number;
      failed: number;
      skipped: number;
      current_operation: string | null;
    })
  | (BaseTaskEvent & {
      type: "task.item.failed";
      item_key: string;
      error: string;
      attempt: number;
    })
  | (BaseTaskEvent & { type: "task.checkpoint.saved"; processed: number })
  | (BaseTaskEvent & {
      type: "task.stage.completed";
      stage: StageKind;
      stage_index: number;
      total_stages: number;
    })
  | (BaseTaskEvent & {
      type: "task.artifact.created";
      artifact_id: UUID;
      name: string;
    })
  | (BaseTaskEvent & { type: "task.cancel.requested" })
  | (BaseTaskEvent & {
      type: "task.completed" | "task.failed" | "task.cancelled";
      status: TaskStatus;
      error_code?: string | null;
      error_message?: string | null;
    });
