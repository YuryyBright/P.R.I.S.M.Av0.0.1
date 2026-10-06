import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/shared/ui/Alert";
import { selectLiveAnswer, type LiveRun } from "../../lib/runReducer";
import type { Message } from "../../types/ai.types";
import { ChevronDownIcon, SpinnerIcon } from "../AiIcons";
import { skeleton } from "../AiUi";
import {
  AssistantBubble,
  LiveAssistantBubble,
  UserBubble,
} from "./MessageBubble";

interface Props {
  /** Changes when another conversation is opened: resets the scroll behaviour. */
  resetKey: string;
  messages: Message[];
  loading: boolean;
  error?: string | null;
  canLoadEarlier: boolean;
  loadingEarlier: boolean;
  onLoadEarlier: () => void;
  agentConversation: boolean;
  liveRun: LiveRun | null;
  connectionLost: boolean;
  streamError: string | null;
  onRetry?: () => void;
  onDismissRun: () => void;
  empty: ReactNode;
}

const NEAR_BOTTOM_PX = 120;

function MessagesSkeleton() {
  const { t } = useTranslation();

  return (
    <div
      aria-busy="true"
      className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6"
    >
      <span className="sr-only">{t("common.loading", "Завантаження…")}</span>

      {[0, 1].map((i) => (
        <div key={i} className="space-y-6">
          <div className="flex flex-row-reverse gap-3">
            <div className={`${skeleton} size-8 rounded-xl`} />
            <div className={`${skeleton} h-10 w-56 rounded-2xl`} />
          </div>

          <div className="flex gap-3">
            <div className={`${skeleton} size-8 rounded-xl`} />

            <div className="flex-1 space-y-2">
              <div className={`${skeleton} h-3.5 w-full max-w-lg`} />
              <div className={`${skeleton} h-3.5 w-full max-w-md`} />
              <div className={`${skeleton} h-3.5 w-2/3 max-w-sm`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Outer component.
 *
 * `key={resetKey}` intentionally remounts the inner scroll container when
 * another conversation is opened. This resets local UI state such as
 * `showJump`, `stick`, and `prevHeight` without calling setState from an
 * effect and without reading refs during render.
 */
export function MessageList(props: Props) {
  return <MessageListInner key={props.resetKey} {...props} />;
}

function MessageListInner({
  messages,
  loading,
  error,
  canLoadEarlier,
  loadingEarlier,
  onLoadEarlier,
  agentConversation,
  liveRun,
  connectionLost,
  streamError,
  onRetry,
  onDismissRun,
  empty,
}: Props) {
  const { t } = useTranslation();

  const scroller = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);
  const prevHeight = useRef<number | null>(null);

  const [showJump, setShowJump] = useState(false);

  const visible = messages.filter(
    (m) => m.role === "user" || m.role === "assistant",
  );

  const showLive = Boolean(
    liveRun &&
    !(liveRun.messageId && messages.some((m) => m.id === liveRun.messageId)),
  );

  // Cheap "something changed in the live bubble" signal:
  // text growth, steps, tool calls, finish.
  const liveSignal = liveRun
    ? selectLiveAnswer(liveRun).length +
      liveRun.steps.length * 1000 +
      liveRun.steps.reduce((n, s) => n + s.toolCalls.length, 0) * 100 +
      (liveRun.finished ? 1 : 0)
    : 0;

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;

    const near =
      el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;

    stick.current = near;
    setShowJump(!near);
  }, []);

  /**
   * The inner component is remounted when `resetKey` changes.
   * Therefore this effect runs once for the newly opened conversation.
   *
   * Important:
   * - no setState here;
   * - no ref access during render;
   * - only DOM synchronization.
   */
  useLayoutEffect(() => {
    stick.current = true;

    const el = scroller.current;

    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  /**
   * New content:
   * - follow the bottom while the user is near it;
   * - preserve the viewport position when older messages are prepended.
   */
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;

    if (prevHeight.current !== null) {
      el.scrollTop += el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
      return;
    }

    if (stick.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [visible.length, liveSignal, showLive, loading]);

  const loadEarlier = () => {
    const el = scroller.current;

    if (el) {
      prevHeight.current = el.scrollHeight;
    }

    stick.current = false;
    onLoadEarlier();
  };

  const jump = () => {
    const el = scroller.current;
    if (!el) return;

    el.scrollTo({
      top: el.scrollHeight,
      behavior: "smooth",
    });
  };

  const isEmpty = !loading && visible.length === 0 && !showLive;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scroller}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={loading}
        className="h-full overflow-y-auto overscroll-contain scroll-smooth"
      >
        {loading ? (
          <MessagesSkeleton />
        ) : isEmpty ? (
          empty
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-4">
            {error && <Alert>{error}</Alert>}

            {canLoadEarlier && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={loadEarlier}
                  disabled={loadingEarlier}
                  className="inline-flex h-8 items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 text-theme-xs font-medium text-gray-600 shadow-xs transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/3 dark:text-gray-300 dark:hover:bg-white/6"
                >
                  {loadingEarlier && <SpinnerIcon className="size-3.5" />}

                  {t("ai.chat.loadEarlier", "Завантажити попередні")}
                </button>
              </div>
            )}

            {visible.map((m) =>
              m.role === "user" ? (
                <UserBubble key={m.id} message={m} />
              ) : (
                <AssistantBubble
                  key={m.id}
                  message={m}
                  canShowSteps={agentConversation}
                />
              ),
            )}

            {showLive && liveRun && (
              <LiveAssistantBubble
                run={liveRun}
                connectionLost={connectionLost}
                streamError={streamError}
                onRetry={onRetry}
                onDismiss={onDismissRun}
              />
            )}
          </div>
        )}
      </div>

      {showJump && !loading && (
        <button
          type="button"
          onClick={jump}
          aria-label={t("ai.chat.jumpToLatest", "До останнього повідомлення")}
          className="absolute inset-s-1/2 bottom-3 inline-flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-md transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none rtl:translate-x-1/2 dark:border-white/10 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <ChevronDownIcon className="size-4.5" />
        </button>
      )}
    </div>
  );
}
