import type {
  RunMode,
  StageKind,
  TaskStatus,
  TaskType,
} from "../types/ai.types";

/** Paths are relative to API_BASE_URL. Router prefix "/ai" is assumed (ai_router). */
export const AI_PATHS = {
  capabilities: "/ai/capabilities",
  conversations: "/ai/conversations",
  conversation: (id: string) => `/ai/conversations/${id}`,
  messages: (id: string) => `/ai/conversations/${id}/messages`,
  attachments: "/ai/attachments",
  startRun: (conversationId: string) =>
    `/ai/conversations/${conversationId}/runs`,
  run: (id: string) => `/ai/runs/${id}`,
  runSteps: (id: string) => `/ai/runs/${id}/steps`,
  runCancel: (id: string) => `/ai/runs/${id}/cancel`,
  runEvents: (id: string) => `/ai/runs/${id}/events`,
  profiles: "/ai/profiles",
  profile: (id: string) => `/ai/profiles/${id}`,
  tasks: "/ai/tasks",
  task: (id: string) => `/ai/tasks/${id}`,
  taskCancel: (id: string) => `/ai/tasks/${id}/cancel`,
  taskResume: (id: string) => `/ai/tasks/${id}/resume`,
  taskEvents: (id: string) => `/ai/tasks/${id}/events`,
  taskArtifacts: (id: string) => `/ai/tasks/${id}/artifacts`,
  /**
   * NOT implemented by the v0.3.0 backend yet (only metadata is listed).
   * Add `GET /ai/tasks/{id}/artifacts/{artifact_id}/download` streaming the bytes from ArtifactStore.
   */
  taskArtifactDownload: (id: string, artifactId: string) =>
    `/ai/tasks/${id}/artifacts/${artifactId}/download`,
} as const;

/** Browser routes owned by this feature. */
export const AI_ROUTES = {
  chat: "/ai/chat",
  chatDetail: (id: string) => `/ai/chat/${id}`,
  tasks: "/ai/tasks",
  taskDetail: (id: string) => `/ai/tasks/${id}`,
  agents: "/ai/agents",
} as const;

/** Create these in the PRISMA permission seed (docs/INTEGRATION.md). Chat/agent endpoints only need auth. */
export const AI_PERMISSIONS = {
  tasksRead: "ai.tasks.read",
  tasksCreate: "ai.tasks.create",
  tasksManage: "ai.tasks.manage",
} as const;

export const CONVERSATIONS_PAGE_SIZE = 30;
export const MESSAGES_PAGE_STEP = 50;
export const MESSAGES_MAX_LIMIT = 200;
export const MAX_MESSAGE_LENGTH = 32000;
export const MAX_CHAT_ATTACHMENTS = 5;
export const MAX_CHAT_ATTACHMENT_SIZE = 25 * 1024 * 1024;
/** Pasted text at least this long (chars) or this many lines becomes a .txt attachment instead of filling the input. */
export const PASTE_AS_ATTACHMENT_CHARS = 5000;
export const PASTE_AS_ATTACHMENT_LINES = 60;
export const TASKS_PAGE_STEP = 30;
export const TASKS_MAX_LIMIT = 200;
export const TASKS_POLL_MS = 4000;

export const MODE_OPTIONS: { value: RunMode; label: string; hint: string }[] = [
  {
    value: "chat",
    label: "Чат",
    hint: "Швидка відповідь, за потреби з пошуком у базах знань",
  },
  {
    value: "agent",
    label: "Агент",
    hint: "Планує кроки та сам викликає інструменти",
  },
];

export const SUGGESTED_PROMPTS: {
  title: string;
  text: string;
  mode: RunMode;
}[] = [
  {
    title: "Підсумок документів",
    text: "Зроби короткий підсумок ключових висновків із вибраних колекцій.",
    mode: "chat",
  },
  {
    title: "Пошук у базі знань",
    text: "Знайди в документах усе, що стосується ризиків безпеки, і наведи джерела.",
    mode: "chat",
  },
  {
    title: "Дослідження від агента",
    text: "Дослідь тему крок за кроком: збери факти з документів, перевір їх і підготуй структуровану відповідь.",
    mode: "agent",
  },
];

/* ───────── tasks ───────── */

export const TASK_TYPE_OPTIONS: {
  value: TaskType;
  label: string;
  hint: string;
}[] = [
  {
    value: "analysis",
    label: "Аналіз",
    hint: "Структурований аналіз документів зі звітом",
  },
  {
    value: "research",
    label: "Дослідження",
    hint: "Збір та узагальнення інформації з джерел",
  },
  {
    value: "document_processing",
    label: "Обробка документів",
    hint: "Пакетна обробка кожного документа",
  },
  {
    value: "dataset_processing",
    label: "Обробка датасету",
    hint: "Map/Reduce над великими наборами даних",
  },
  {
    value: "report_generation",
    label: "Генерація звіту",
    hint: "Підготовка підсумкового звіту",
  },
  {
    value: "agent_task",
    label: "Завдання агента",
    hint: "Довготривала автономна задача",
  },
];

export const TASK_FORMAT_OPTIONS = [
  { value: "markdown", label: "Markdown" },
  { value: "docx", label: "Word (DOCX)" },
  { value: "pdf", label: "PDF" },
  { value: "xlsx", label: "Excel (XLSX)" },
  { value: "csv", label: "CSV" },
  { value: "json", label: "JSON" },
  { value: "txt", label: "Текст" },
] as const;

export const STAGE_LABELS: Record<StageKind, string> = {
  ingest: "Збір даних",
  preprocess: "Підготовка",
  filter: "Фільтрація",
  retrieve: "Пошук",
  rerank: "Переранжування",
  analyze: "Аналіз",
  deduplicate: "Дедуплікація",
  synthesize: "Синтез",
  export: "Експорт",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  queued: "У черзі",
  running: "Виконується",
  paused: "Призупинено",
  cancelling: "Зупиняється",
  cancelled: "Скасовано",
  failed: "Помилка",
  completed: "Завершено",
  waiting_for_input: "Очікує відповіді",
  waiting_for_tool: "Очікує інструмент",
};

export const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  "queued",
  "running",
  "paused",
  "cancelling",
  "waiting_for_input",
  "waiting_for_tool",
];
export const TERMINAL_TASK_STATUSES: TaskStatus[] = [
  "cancelled",
  "failed",
  "completed",
];
/** Backend: FAILED/CANCELLED/PAUSED -> QUEUED on resume. */
export const RESUMABLE_TASK_STATUSES: TaskStatus[] = [
  "failed",
  "cancelled",
  "paused",
];
/** Stop is meaningful while the task has not finished and is not already stopping. */
export const STOPPABLE_TASK_STATUSES: TaskStatus[] = [
  "queued",
  "running",
  "waiting_for_input",
  "waiting_for_tool",
];
