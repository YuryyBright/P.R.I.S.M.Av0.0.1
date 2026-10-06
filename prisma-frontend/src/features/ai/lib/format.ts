import type { Conversation, ConversationSettings } from "../types/ai.types";

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)} мс`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${(ms / 1000).toFixed(s < 10 ? 1 : 0)} с`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} хв ${String(s % 60).padStart(2, "0")} с`;
  const h = Math.floor(m / 60);
  return `${h} год ${String(m % 60).padStart(2, "0")} хв`;
}

/** Elapsed wall-clock between two ISO dates (end defaults to `now`). */
export function elapsedMs(
  start: string | null | undefined,
  end?: string | null,
  now: number = Date.now(),
): number | null {
  if (!start) return null;
  const a = Date.parse(start);
  if (Number.isNaN(a)) return null;
  const b = end ? Date.parse(end) : now;
  return Math.max(0, b - a);
}

export function formatBytes(n: number | null | undefined): string {
  if (!n || n < 0) return "—";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatNumber(n: number | null | undefined): string {
  return typeof n === "number" ? n.toLocaleString("uk-UA") : "—";
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

/** "щойно", "5 хв тому", "вчора", else a short date. */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "щойно";
  if (min < 60) return `${min} хв тому`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} год тому`;
  const d = Math.floor(h / 24);
  if (d === 1) return "вчора";
  if (d < 7) return `${d} дн тому`;
  return new Date(t).toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "short",
  });
}

export type DayBucket = "today" | "yesterday" | "week" | "older";

export function dayBucket(iso: string, now: Date = new Date()): DayBucket {
  const d = new Date(iso);
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.floor((startOf(now) - startOf(d)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return "week";
  return "older";
}

export const DAY_BUCKET_LABELS: Record<DayBucket, string> = {
  today: "Сьогодні",
  yesterday: "Вчора",
  week: "Останні 7 днів",
  older: "Раніше",
};

export function conversationTitle(c: Pick<Conversation, "title">): string {
  return c.title?.trim() || "Новий діалог";
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Compact one-line preview of tool arguments: `query: "..." , limit: 5`. */
export function previewArgs(args: Record<string, unknown>, max = 140): string {
  const parts = Object.entries(args).map(([k, v]) => {
    const val = typeof v === "string" ? `"${v}"` : JSON.stringify(v);
    return `${k}: ${val}`;
  });
  return truncate(parts.join(", "), max);
}

export function safeJson(value: unknown, max = 1200): string {
  try {
    return truncate(JSON.stringify(value, null, 2), max);
  } catch {
    return String(value);
  }
}

export const DEFAULT_SETTINGS: ConversationSettings = {
  mode: "chat",
  model: null,
  rag_enabled: false,
  web_enabled: false,
  collection_ids: null,
  reranker: { enabled: false, top_k: null },
  prompt_template_id: null,
  prompt_version_id: null,
  prompt_variables: {},
  profile_id: null,
};

/** Effective settings = defaults <- conversation.settings <- local draft. */
export function mergeSettings(
  ...layers: (Partial<ConversationSettings> | null | undefined)[]
): ConversationSettings {
  return layers.reduce<ConversationSettings>(
    (acc, layer) => (layer ? { ...acc, ...layer } : acc),
    { ...DEFAULT_SETTINGS },
  );
}
