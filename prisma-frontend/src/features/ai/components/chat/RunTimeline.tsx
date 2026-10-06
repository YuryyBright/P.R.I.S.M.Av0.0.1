import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useGetRunStepsQuery } from "../../api/ai.endpoints";
import {
  formatDuration,
  previewArgs,
  safeJson,
  truncate,
} from "../../lib/format";
import type { LiveStep } from "../../lib/runReducer";
import type { RunStep, StepType } from "../../types/ai.types";
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  CpuIcon,
  SearchIcon,
  SpinnerIcon,
  WrenchIcon,
} from "../AiIcons";

/* ───────── normalized shape: live steps and persisted steps render the same ───────── */

export interface TimelineTool {
  id: string;
  name: string;
  args?: string;
  status: "running" | "ok" | "error";
  summary?: string;
  latencyMs?: number;
}
export interface TimelineChunk {
  n: number;
  title: string;
  page: number | null;
  score: number;
  preview: string;
}
export interface TimelineStep {
  key: string;
  kind: StepType;
  title: string;
  status: "running" | "ok" | "error";
  latencyMs?: number;
  /** model commentary on a step that ended with tool calls */
  comment?: string;
  tools: TimelineTool[];
  query?: string;
  rewrittenQuery?: string | null;
  chunks: TimelineChunk[];
  reranked?: boolean;
  warnings: string[];
  /** persisted steps only: raw output for the "details" disclosure */
  detail?: string;
}

export function liveToTimeline(steps: LiveStep[]): TimelineStep[] {
  return steps.map((s) => ({
    key: `s${s.idx}`,
    kind: s.kind,
    title: s.title,
    status: s.status,
    latencyMs: s.latencyMs,
    comment: s.hasToolCalls && s.text.trim() ? s.text.trim() : undefined,
    tools: s.toolCalls.map((t) => ({
      id: t.id,
      name: t.name,
      args: Object.keys(t.args).length ? previewArgs(t.args) : undefined,
      status: t.status,
      summary: t.summary,
      latencyMs: t.latencyMs,
    })),
    query: s.retrieval?.query,
    rewrittenQuery: s.retrieval?.rewrittenQuery,
    chunks: (s.retrieval?.chunks ?? []).map((c) => ({
      n: c.n,
      title: c.document_title,
      page: c.page,
      score: c.rerank_score ?? c.score,
      preview: c.preview,
    })),
    reranked: s.retrieval?.reranked,
    warnings: s.retrieval?.warnings ?? [],
  }));
}

export function persistedToTimeline(steps: RunStep[]): TimelineStep[] {
  return steps.map((s) => ({
    key: `p${s.idx}`,
    kind: s.type,
    title: s.name ?? s.type,
    status: s.status === "error" ? "error" : "ok",
    latencyMs: s.latency_ms,
    tools: [],
    chunks: [],
    warnings: [],
    detail:
      Object.keys(s.output ?? {}).length || Object.keys(s.input ?? {}).length
        ? safeJson({ input: s.input, output: s.output })
        : undefined,
  }));
}

/* ───────── UI ───────── */

const KIND_ICON: Record<StepType, (p: { className?: string }) => ReactNode> = {
  llm_call: (p) => <CpuIcon {...p} />,
  tool_call: (p) => <WrenchIcon {...p} />,
  retrieval: (p) => <SearchIcon {...p} />,
};

function StatusDot({ status }: { status: TimelineStep["status"] }) {
  if (status === "running")
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
        <SpinnerIcon className="size-3.5" />
      </span>
    );
  if (status === "error")
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400">
        <AlertTriangleIcon className="size-3.5" />
      </span>
    );
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400">
      <CheckIcon className="size-3.5" />
    </span>
  );
}

function ToolRow({ tool }: { tool: TimelineTool }) {
  const tone =
    tool.status === "error"
      ? "text-error-600 dark:text-error-400"
      : "text-gray-500 dark:text-gray-400";
  return (
    <li className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <code className="font-mono text-theme-xs font-semibold text-gray-800 dark:text-white/90">
          {tool.name}
        </code>
        {tool.latencyMs !== undefined && (
          <span className="text-theme-xs text-gray-400 tabular-nums dark:text-gray-500">
            {formatDuration(tool.latencyMs)}
          </span>
        )}
        {tool.status === "running" && (
          <SpinnerIcon className="size-3.5 text-brand-500" />
        )}
      </div>
      {tool.args && (
        <p className="mt-0.5 font-mono text-theme-xs break-all text-gray-500 dark:text-gray-400">
          {tool.args}
        </p>
      )}
      {tool.summary && (
        <p className={`mt-1 text-theme-xs wrap-break-word ${tone}`}>
          {truncate(tool.summary, 400)}
        </p>
      )}
    </li>
  );
}

function ChunkList({ chunks }: { chunks: TimelineChunk[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!chunks.length) return null;
  const shown = open ? chunks : chunks.slice(0, 3);
  return (
    <div>
      <ul className="space-y-1.5">
        {shown.map((c) => (
          <li
            key={c.n}
            className="rounded-lg border border-gray-100 px-3 py-2 dark:border-white/5"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-theme-xs font-medium text-gray-700 dark:text-gray-300">
                <span className="me-1.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-md bg-brand-50 px-1 text-[11px] font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                  {c.n}
                </span>
                {c.title}
                {c.page ? `, ${t("ai.chat.page", "с.")} ${c.page}` : ""}
              </span>
              <span className="shrink-0 text-theme-xs text-gray-400 tabular-nums dark:text-gray-500">
                {c.score.toFixed(2)}
              </span>
            </div>
            {open && c.preview && (
              <p className="mt-1 line-clamp-3 text-theme-xs text-gray-500 dark:text-gray-400">
                {c.preview}
              </p>
            )}
          </li>
        ))}
      </ul>
      {chunks.length > 3 || chunks.some((c) => c.preview) ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1.5 rounded text-theme-xs font-medium text-brand-600 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:text-brand-400"
        >
          {open
            ? t("ai.timeline.less", "Згорнути")
            : t("ai.timeline.more", "Показати більше")}
        </button>
      ) : null}
    </div>
  );
}

function StepItem({ step, last }: { step: TimelineStep; last: boolean }) {
  const { t } = useTranslation();
  const Kind = KIND_ICON[step.kind];
  const hasBody =
    step.tools.length > 0 ||
    step.chunks.length > 0 ||
    Boolean(step.comment) ||
    Boolean(step.query) ||
    step.warnings.length > 0 ||
    Boolean(step.detail);

  return (
    <li className="relative flex gap-3">
      {!last && (
        <span
          aria-hidden="true"
          className="absolute start-3 top-7 -bottom-3 w-px bg-gray-200 dark:bg-white/10"
        />
      )}
      <StatusDot status={step.status} />
      <div className="min-w-0 flex-1 pb-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-gray-400 dark:text-gray-500">
            <Kind className="size-4" />
          </span>
          <span className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
            {step.title}
          </span>
          {step.latencyMs !== undefined && (
            <span className="text-theme-xs text-gray-400 tabular-nums dark:text-gray-500">
              {formatDuration(step.latencyMs)}
            </span>
          )}
        </div>

        {hasBody && (
          <div className="mt-2 space-y-2">
            {step.comment && (
              <p className="text-theme-xs leading-5 whitespace-pre-wrap text-gray-500 italic dark:text-gray-400">
                {truncate(step.comment, 600)}
              </p>
            )}
            {step.query && (
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                <span className="text-gray-400 dark:text-gray-500">
                  {t("ai.timeline.query", "Запит")}:
                </span>{" "}
                {step.rewrittenQuery && step.rewrittenQuery !== step.query
                  ? step.rewrittenQuery
                  : step.query}
                {step.reranked && (
                  <span className="ms-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600 dark:bg-white/10 dark:text-gray-300">
                    {t("ai.timeline.reranked", "переранжовано")}
                  </span>
                )}
              </p>
            )}
            {step.warnings.map((w) => (
              <p
                key={w}
                className="text-theme-xs text-warning-600 dark:text-warning-400"
              >
                {w}
              </p>
            ))}
            <ChunkList chunks={step.chunks} />
            {step.tools.length > 0 && (
              <ul className="space-y-1.5">
                {step.tools.map((tool) => (
                  <ToolRow key={tool.id} tool={tool} />
                ))}
              </ul>
            )}
            {step.detail && (
              <details className="group">
                <summary className="cursor-pointer list-none text-theme-xs font-medium text-brand-600 select-none hover:text-brand-700 dark:text-brand-400">
                  {t("ai.timeline.details", "Деталі кроку")}
                </summary>
                <pre className="mt-1.5 max-h-60 overflow-auto rounded-lg bg-gray-50 p-2.5 font-mono text-[12px] leading-5 text-gray-600 dark:bg-black/30 dark:text-gray-300">
                  {step.detail}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

interface RunTimelineProps {
  steps: TimelineStep[];
  /** Expanded while the run is live, collapsed once it is part of history. */
  defaultOpen?: boolean;
  live?: boolean;
  className?: string;
}

export function RunTimeline({
  steps,
  defaultOpen = false,
  live = false,
  className = "",
}: RunTimelineProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  if (!steps.length) return null;

  const failed = steps.filter((s) => s.status === "error").length;
  const toolCount = steps.reduce((n, s) => n + s.tools.length, 0);
  const expanded = live || open;

  return (
    <section
      aria-label={t("ai.timeline.title", "Кроки агента")}
      className={`rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/3 ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
        disabled={live}
        className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-start focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none disabled:cursor-default"
      >
        <span className="text-brand-500 dark:text-brand-400">
          {live ? <SpinnerIcon className="size-4" /> : <WrenchIcon className="size-4" />}
        </span>
        <span className="min-w-0 flex-1 truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
          {live
            ? t("ai.timeline.working", "Агент працює…")
            : t("ai.timeline.title", "Кроки агента")}
          <span className="ms-2 font-normal text-gray-500 dark:text-gray-400">
            {t("ai.timeline.summary", "{{steps}} кр.", { steps: steps.length })}
            {toolCount > 0 &&
              ` · ${t("ai.timeline.tools", "{{count}} викл.", { count: toolCount })}`}
            {failed > 0 && ` · ${t("ai.timeline.failed", "помилок: {{count}}", { count: failed })}`}
          </span>
        </span>
        {!live && (
          <ChevronDownIcon
            className={`size-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        )}
      </button>
      {expanded && (
        <ol className="border-t border-gray-100 px-3.5 pt-3.5 dark:border-white/5">
          {steps.map((s, i) => (
            <StepItem key={s.key} step={s} last={i === steps.length - 1} />
          ))}
        </ol>
      )}
    </section>
  );
}

/** History: lazily loads persisted steps of a finished run when the user opens them. */
export function PersistedRunTimeline({ runId }: { runId: string }) {
  const { t } = useTranslation();
  const [requested, setRequested] = useState(false);
  const { data, isFetching, error } = useGetRunStepsQuery(runId, { skip: !requested });

  if (!requested) {
    return (
      <button
        type="button"
        onClick={() => setRequested(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-theme-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white/90"
      >
        <WrenchIcon className="size-3.5" />
        {t("ai.timeline.show", "Показати кроки агента")}
      </button>
    );
  }
  if (isFetching && !data) {
    return (
      <p className="inline-flex items-center gap-2 text-theme-xs text-gray-500 dark:text-gray-400">
        <SpinnerIcon className="size-3.5" />
        {t("common.loading", "Завантаження…")}
      </p>
    );
  }
  if (error || !data?.length) {
    return (
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        {t("ai.timeline.empty", "Кроків не збережено.")}
      </p>
    );
  }
  return <RunTimeline steps={persistedToTimeline(data)} defaultOpen />;
}
