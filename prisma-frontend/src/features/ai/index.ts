// Public API of the AI feature. Import from "@/features/ai" only.
// Deliberately NOT exported: endpoints/RTK hooks, components, reducers.
export { aiRoutes } from "./routes";
export { aiUiSlice } from "./store/aiUiSlice";
export { configureAiTransport } from "./lib/sse";
export { AI_PERMISSIONS, AI_ROUTES } from "./constants/ai.constants";
export type {
  Conversation,
  ConversationSettings,
  RunMode,
  Task,
  TaskStatus,
} from "./types/ai.types";
