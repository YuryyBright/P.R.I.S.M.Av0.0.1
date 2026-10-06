import type { ISODateString, UUID } from "@/shared/types/api";

/* =====================================================================
 * REST TYPES  (app/ai/schemas.py, app/ai/task_api.py)
 * AI API has NO {data, message} envelope: bodies are plain objects,
 * lists are Page[T] = {items, total, limit, offset} (tasks/profiles: plain arrays).
 * ===================================================================== */

export type RunMode = "chat" | "agent";
export type RunStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled";
export type StepType = "llm_call" | "tool_call" | "retrieval";
export type ToolRisk = "read" | "write";
export type PromptKind =
  | "chat_system"
  | "agent_system"
  | "query_rewrite"
  | "rerank";

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/* ───────── conversations ───────── */

export interface RerankerSettings {
  enabled: boolean;
  top_k?: number | null;
}

/** ConversationSettings. `collection_ids: null` = all accessible; `[]` with RAG on is a backend error. */
export interface ConversationSettings {
  mode: RunMode;
  model: string | null;
  rag_enabled: boolean;
  web_enabled: boolean;
  collection_ids: UUID[] | null;
  reranker: RerankerSettings;
  prompt_template_id: UUID | null;
  prompt_version_id: UUID | null;
  prompt_variables: Record<string, string>;
  profile_id: UUID | null;
}
export type ConversationSettingsPatch = Partial<ConversationSettings>;

export interface Conversation {
  id: UUID;
  title: string | null;
  mode: string;
  is_archived: boolean;
  settings: Partial<ConversationSettings>;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface ConversationCreatePayload {
  title?: string | null;
  settings?: ConversationSettingsPatch;
}
export interface ConversationUpdatePayload {
  title?: string | null;
  is_archived?: boolean;
  settings?: ConversationSettingsPatch;
}

/* ───────── messages / runs ───────── */

export interface Citation {
  rank: number;
  document_id: UUID | null;
  chunk_id: UUID | null;
  score: number | null;
  citation_text: string;
  meta: Record<string, unknown>;
}

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface Message {
  id: UUID;
  role: MessageRole | (string & {});
  content: string;
  model: string | null;
  finish_reason: string | null;
  created_at: ISODateString;
  run_id: UUID | null;
  citations: Citation[];
}

export interface StartRunPayload {
  content: string;
  mode?: RunMode | null;
  settings?: ConversationSettingsPatch | null;
  attachment_ids?: UUID[];
}
export interface StartRunResponse {
  run_id: UUID;
  user_message_id: UUID;
  conversation_id: UUID;
  mode: RunMode;
  status: RunStatus;
}

export interface Run {
  id: UUID;
  conversation_id: UUID;
  mode: RunMode;
  status: RunStatus;
  config: Record<string, unknown>;
  usage: Record<string, number>;
  assistant_message_id: UUID | null;
  started_at: ISODateString | null;
  finished_at: ISODateString | null;
  error_code: string | null;
  error_message: string | null;
  created_at: ISODateString;
}

export interface RunStep {
  idx: number;
  type: StepType;
  name: string | null;
  status: "ok" | "error";
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  latency_ms: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
}

/* ───────── capabilities / profiles / prompts ───────── */

export interface ModelCap {
  alias: string;
  label: string;
  vision: boolean;
  tools: boolean;
  context_len: number;
  default: boolean;
}
export interface ToolCap {
  name: string;
  description: string;
  risk: ToolRisk | (string & {});
  requires_rag: boolean;
}
export interface PromptTemplate {
  id: UUID;
  owner_id: UUID | null;
  slug: string;
  name: string;
  kind: PromptKind;
  description: string | null;
  is_archived: boolean;
  active_version_id: UUID | null;
}
export interface AgentProfile {
  id: UUID;
  owner_id: UUID | null;
  name: string;
  description: string | null;
  prompt_template_id: UUID;
  model: string | null;
  allowed_tools: string[];
  default_collection_ids: UUID[];
  max_steps: number;
}
export interface Capabilities {
  modes: RunMode[];
  models: ModelCap[];
  reranker: { available: boolean; model: string | null; default_top_k: number };
  tools: ToolCap[];
  profiles: AgentProfile[];
  prompts: PromptTemplate[];
  limits: Record<string, number>;
}
export interface ProfileCreatePayload {
  name: string;
  description?: string | null;
  prompt_template_id: UUID;
  model?: string | null;
  allowed_tools: string[];
  default_collection_ids: UUID[];
  max_steps: number;
}

/* ───────── tasks ───────── */

export type TaskStatus =
  | "queued"
  | "running"
  | "paused"
  | "cancelling"
  | "cancelled"
  | "failed"
  | "completed"
  | "waiting_for_input"
  | "waiting_for_tool";
export type TaskType =
  | "analysis"
  | "research"
  | "document_processing"
  | "dataset_processing"
  | "report_generation"
  | "agent_task";
export type StageKind =
  | "ingest"
  | "preprocess"
  | "filter"
  | "retrieve"
  | "rerank"
  | "analyze"
  | "deduplicate"
  | "synthesize"
  | "export";

export interface TaskProgressData {
  stage?: StageKind | string | null;
  processed?: number;
  total?: number;
  percent?: number;
  successful?: number;
  failed?: number;
  skipped?: number;
  current_operation?: string | null;
}
export interface TaskSource {
  type: string;
  id: string;
  metadata?: Record<string, unknown>;
}

export interface Task {
  id: UUID;
  user_id: UUID;
  type: TaskType;
  status: TaskStatus;
  title: string;
  instruction: string;
  config: Record<string, unknown>;
  sources: TaskSource[];
  progress: TaskProgressData;
  current_stage: string | null;
  stage_index: number;
  total_stages: number;
  checkpoint: Record<string, unknown>;
  celery_task_id: string | null;
  result_artifact_id: UUID | null;
  error: string | null;
  started_at: ISODateString | null;
  finished_at: ISODateString | null;
  heartbeat_at: ISODateString | null;
  cancellation_requested: boolean;
  created_at: ISODateString;
}

export interface TaskCreatePayload {
  instruction: string;
  type: TaskType;
  title?: string | null;
  sources: TaskSource[];
  config: Record<string, unknown>;
  output: { formats: string[] };
}
export interface TaskCreateResponse {
  task_id: UUID;
  status: TaskStatus;
}

/** AiArtifact row (metadata only; bytes live in the host blob storage). */
export interface TaskArtifact {
  id: UUID;
  task_id: UUID;
  owner_id?: UUID;
  type: string;
  name: string;
  mime_type: string;
  size: number;
  meta?: Record<string, unknown>;
  created_at?: ISODateString;
}

/* ───────── query args ───────── */

export interface ConversationsPageArgs {
  page?: number;
  size?: number;
  archived?: boolean;
}
export interface MessagesArgs {
  conversationId: UUID;
  limit?: number;
}
export interface TasksArgs {
  limit?: number;
  offset?: number;
}
