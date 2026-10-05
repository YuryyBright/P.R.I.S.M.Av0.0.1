import type { AiEventType, AiRunEvent } from "../types/ai.types";

export interface AiSseHandlers {
  onEvent: (event: AiRunEvent) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
}

export function connectAiRunEvents(
  runId: string,
  handlers: AiSseHandlers,
): () => void {
  const url = `/ai/runs/${encodeURIComponent(runId)}/events`;
  const source = new EventSource(url, { withCredentials: true });

  const eventTypes: AiEventType[] = [
    "run.started",
    "run.status",
    "step.started",
    "step.progress",
    "retrieval.started",
    "retrieval.result",
    "retrieval.completed",
    "tool.started",
    "tool.result",
    "llm.delta",
    "llm.completed",
    "citation.created",
    "run.completed",
    "run.failed",
    "run.cancelled",
    "heartbeat",
    "error",
  ];

  const handle = (event: MessageEvent<string>) => {
    try {
      const parsed = JSON.parse(event.data) as AiRunEvent;
      handlers.onEvent(parsed);
    } catch {
      // Ignore malformed keep-alive frames. Backend should send JSON for named events.
    }
  };

  for (const type of eventTypes) source.addEventListener(type, handle);
  source.onopen = () => handlers.onOpen?.();
  source.onerror = (event) => handlers.onError?.(event);

  return () => {
    for (const type of eventTypes) source.removeEventListener(type, handle);
    source.close();
  };
}
