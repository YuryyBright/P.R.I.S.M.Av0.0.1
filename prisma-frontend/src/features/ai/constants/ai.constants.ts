export const AI_PATHS = {
  runs: "/ai/runs",
  events: (runId: string) => `/ai/runs/${runId}/events`,
  cancel: (runId: string) => `/ai/runs/${runId}/cancel`,
  capabilities: "/ai/capabilities",
} as const;

export const AI_MODES = ["chat", "agent"] as const;
export type AiMode = (typeof AI_MODES)[number];

export const DEFAULT_AI_CONFIG = {
  model: "default",
  temperature: 0.2,
  maxOutputTokens: 2048,
  ragEnabled: true,
  rerankerEnabled: true,
  collectionIds: [] as string[],
  topK: 8,
  rerankTopK: 5,
  agentProfileId: undefined as string | undefined,
} as const;

export const ACCEPTED_AI_ATTACHMENTS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
