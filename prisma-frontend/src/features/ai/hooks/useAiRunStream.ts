import { useCallback, useEffect, useRef, useState } from "react";
import { connectAiRunEvents } from "../lib/sse";
import type { AiRunEvent } from "../types/ai.types";

export function useAiRunStream(runId?: string) {
  const [events, setEvents] = useState<AiRunEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!runId) {
      return;
    }

    const cleanup = connectAiRunEvents(runId, {
      onOpen: () => {
        setConnected(true);
      },

      onEvent: (event) => {
        setEvents((current) => [...current, event]);

        if (
          event.type === "run.completed" ||
          event.type === "run.failed" ||
          event.type === "run.cancelled"
        ) {
          setConnected(false);
        }
      },

      onError: () => {
        setConnected(false);
      },
    });

    cleanupRef.current = cleanup;

    return () => {
      cleanup();
      cleanupRef.current = null;
    };
  }, [runId]);

  const clear = useCallback(() => {
    setEvents([]);
    setConnected(false);
  }, []);

  return {
    events,
    connected,
    clear,
  };
}
