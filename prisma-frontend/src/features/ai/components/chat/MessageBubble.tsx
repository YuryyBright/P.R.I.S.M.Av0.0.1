import { memo, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/shared/ui/Alert";
import { formatTime } from "../../lib/format";
import {
  selectIsThinking,
  selectLiveAnswer,
  type LiveRun,
} from "../../lib/runReducer";
import type { Message } from "../../types/ai.types";
import {
  BotIcon,
  CheckIcon,
  CopyIcon,
  RefreshIcon,
  UserIcon,
  XIcon,
  btnContent,
} from "../AiIcons";
import { Markdown } from "./Markdown";
import {
  liveToTimeline,
  PersistedRunTimeline,
  RunTimeline,
} from "./RunTimeline";
import { liveSources, persistedSources, Sources, toLookup } from "./Sources";

/* ───────── shared bits ───────── */

function Avatar({ role }: { role: "user" | "assistant" }) {
  return role === "assistant" ? (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-xs"
    >
      <BotIcon className="size-4.5" />
    </span>
  ) : (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 ring-1 ring-gray-200/70 ring-inset dark:bg-white/5 dark:text-gray-400 dark:ring-white/5"
    >
      <UserIcon className="size-4.5" />
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-theme-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white/90"
    >
      {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
      {copied ? t("ai.common.copied", "Скопійовано") : t("ai.common.copy", "Копіювати")}
    </button>
  );
}

function TypingDots() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-label={t("ai.chat.thinking", "Думаю…")}
      className="flex items-center gap-1.5 py-2"
    >
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          style={{ animationDelay: `${d}ms` }}
          className="size-2 animate-bounce rounded-full bg-gray-300 motion-reduce:animate-none dark:bg-gray-600"
        />
      ))}
    </div>
  );
}

function Meta({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-theme-xs text-gray-400 dark:text-gray-500">
      {children}
    </p>
  );
}

/* ───────── user ───────── */

export const UserBubble = memo(function UserBubble({ message }: { message: Pick<Message, "content" | "created_at"> }) {
  return (
    <div className="flex flex-row-reverse items-start gap-3">
      <Avatar role="user" />
      <div className="flex min-w-0 max-w-[85%] flex-col items-end sm:max-w-[75%]">
        <div className="rounded-2xl rounded-te-md bg-brand-500 px-4 py-2.5 text-theme-sm leading-6 wrap-break-word whitespace-pre-wrap text-white shadow-xs">
          {message.content}
        </div>
        <Meta>{formatTime(message.created_at)}</Meta>
      </div>
    </div>
  );
});

/* ───────── assistant (persisted) ───────── */

interface AssistantProps {
  message: Message;
  /** Conversation used the agent: offer the persisted step timeline. */
  canShowSteps: boolean;
}

export const AssistantBubble = memo(function AssistantBubble({ message, canShowSteps }: AssistantProps) {
  const { t } = useTranslation();
  const sources = useMemo(() => persistedSources(message.citations), [message.citations]);
  const lookup = useMemo(() => toLookup(sources), [sources]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className="group/msg flex items-start gap-3">
      <Avatar role="assistant" />
      <div className="min-w-0 max-w-full flex-1 sm:max-w-[85%]">
        {canShowSteps && message.run_id && (
          <div className="mb-2">
            <PersistedRunTimeline runId={message.run_id} />
          </div>
        )}
        <Markdown
          text={message.content}
          citations={lookup}
          onCite={(n) => {
            setActive(n);
            setOpen(true);
          }}
        />
        <Sources
          items={sources}
          open={open}
          activeN={active}
          onToggle={(v) => {
            setOpen(v);
            if (!v) setActive(null);
          }}
        />
        <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within/msg:opacity-100 sm:group-hover/msg:opacity-100">
          <CopyButton text={message.content} />
          <span className="text-theme-xs text-gray-400 dark:text-gray-500">
            {formatTime(message.created_at)}
            {message.model ? ` · ${message.model}` : ""}
            {message.finish_reason === "length"
              ? ` · ${t("ai.chat.truncated", "відповідь обрізано")}`
              : ""}
          </span>
        </div>
      </div>
    </div>
  );
});

/* ───────── assistant (live, streaming) ───────── */

interface LiveProps {
  run: LiveRun;
  connectionLost?: boolean;
  streamError?: string | null;
  onRetry?: () => void;
  onDismiss: () => void;
}

export function LiveAssistantBubble({
  run,
  connectionLost,
  streamError,
  onRetry,
  onDismiss,
}: LiveProps) {
  const { t } = useTranslation();
  const answer = selectLiveAnswer(run);
  const thinking = selectIsThinking(run);

  const isAgent = run.mode === "agent";
  const timelineSteps = useMemo(
    () =>
      liveToTimeline(
        isAgent ? run.steps : run.steps.filter((s) => s.kind !== "llm_call"),
      ),
    [run.steps, isAgent],
  );

  const sources = useMemo(() => liveSources(run), [run]);
  const lookup = useMemo(() => toLookup(sources), [sources]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  const cancelled = run.status === "cancelled";
  const failed = run.status === "failed";
  const showSteps = timelineSteps.length > 0;

  return (
    <div className="flex items-start gap-3">
      <Avatar role="assistant" />
      <div className="min-w-0 max-w-full flex-1 sm:max-w-[85%]">
        {showSteps && (
          <RunTimeline
            steps={timelineSteps}
            live={!run.finished}
            defaultOpen={false}
            className="mb-3"
          />
        )}

        {thinking && !run.finished && !showSteps && <TypingDots />}

        {answer && (
          <div className="relative">
            <Markdown
              text={answer}
              citations={lookup}
              onCite={(n) => {
                setActive(n);
                setOpen(true);
              }}
            />
            {!run.finished && (
              <span
                aria-hidden="true"
                className="ms-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-brand-500 motion-reduce:animate-none"
              />
            )}
          </div>
        )}

        {run.finished && (
          <Sources
            items={sources}
            open={open}
            activeN={active}
            onToggle={(v) => {
              setOpen(v);
              if (!v) setActive(null);
            }}
          />
        )}

        {connectionLost && !run.finished && (
          <p className="mt-2 text-theme-xs text-warning-600 dark:text-warning-400" role="status">
            {t("ai.chat.reconnecting", "З'єднання перервано, відновлюємо…")}
          </p>
        )}

        {streamError && !run.finished && (
          <div className="mt-2">
            <Alert>{streamError}</Alert>
          </div>
        )}

        {failed && (
          <div className="mt-2 space-y-2">
            <Alert>
              {run.error?.message ??
                t("ai.chat.runFailed", "Не вдалося отримати відповідь.")}
            </Alert>
            <div className="flex flex-wrap gap-2">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className={`${btnContent} h-9 rounded-lg border border-gray-200 bg-white px-3 text-theme-sm font-medium text-gray-700 shadow-xs transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:border-white/10 dark:bg-white/3 dark:text-gray-300 dark:hover:bg-white/6`}
                >
                  <RefreshIcon className="size-4" />
                  {t("ai.chat.retry", "Спробувати ще раз")}
                </button>
              )}
              <button
                type="button"
                onClick={onDismiss}
                className={`${btnContent} h-9 rounded-lg px-3 text-theme-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:text-gray-400 dark:hover:bg-white/5`}
              >
                <XIcon className="size-4" />
                {t("common.close", "Закрити")}
              </button>
            </div>
          </div>
        )}

        {cancelled && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-theme-xs font-medium text-gray-600 dark:bg-white/5 dark:text-gray-300">
              {t("ai.chat.stopped", "Зупинено")}
            </span>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded text-theme-xs font-medium text-brand-600 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:text-brand-400"
            >
              {t("common.close", "Закрити")}
            </button>
          </div>
        )}

        {run.finished && run.status === "completed" && run.usage && (
          <Meta>
            <span>
              {run.model ? `${run.model} · ` : ""}
              {t("ai.chat.tokens", "{{n}} токенів", {
                n: run.usage.prompt + run.usage.completion,
              })}
            </span>
          </Meta>
        )}
      </div>
    </div>
  );
}
