export type UUID = string;

export type AiMode = "chat" | "agent";
export type AiRunStatus =
  "queued" | "running" | "completed" | "failed" | "cancelled";

export type AiEventType =
  | "run.started"
  | "run.status"
  | "step.started"
  | "step.progress"
  | "retrieval.started"
  | "retrieval.result"
  | "retrieval.completed"
  | "tool.started"
  | "tool.result"
  | "llm.delta"
  | "llm.completed"
  | "citation.created"
  | "run.completed"
  | "run.failed"
  | "run.cancelled"
  | "heartbeat"
  | "error";

export interface AiAttachment {
  id?: UUID;
  name: string;
  mimeType: string;
  size: number;
  url?: string;
  file?: File;
  kind: "image" | "video" | "document";
}

export interface AiCitation {
  number: number;
  chunkId: UUID;
  title?: string;
  page?: number;
  headingPath?: string[];
  snippet?: string;
  score?: number;
}

export interface AiRunConfig {
  mode: AiMode;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  ragEnabled: boolean;
  rerankerEnabled: boolean;
  collectionIds: string[];
  topK: number;
  rerankTopK: number;
  agentProfileId?: string;
  allowedTools?: string[];
}

export interface AiRunRequest {
  chatId?: UUID;
  message: string;
  config: AiRunConfig;
  attachments?: File[];
}
export interface AiChat {
  id: UUID;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiChatMessage {
  id: UUID;
  chatId: UUID;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  runId?: UUID;
  attachments?: AiAttachment[];
  citations?: AiCitation[];
}
export interface AiRun {
  id: UUID;
  status: AiRunStatus;
  mode: AiMode;
  createdAt: string;
  config: AiRunConfig;
}

export interface AiRunEvent<T = unknown> {
  id?: string;
  type: AiEventType;
  runId: UUID;
  timestamp: string;
  data: T;
}

export interface RetrievalResultData {
  query?: string;
  chunks?: Array<{
    chunkId: UUID;
    title?: string;
    page?: number;
    score?: number;
    rerankScore?: number;
    snippet?: string;
  }>;
}

export interface ToolEventData {
  tool: string;
  callId?: string;
  input?: unknown;
  output?: unknown;
  risk?: "low" | "medium" | "high";
}

export interface LlmDeltaData {
  text: string;
}
