import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useSearchParams } from "react-router";
import { Alert } from "@/shared/ui/Alert";
import type { UUID } from "@/shared/types/api";
import { BotIcon, MenuIcon, MessageIcon, SlidersIcon } from "../components/AiIcons";
import { iconButton, Pill } from "../components/AiUi";
import { Composer } from "../components/chat/Composer";
import { ConversationSidebar } from "../components/chat/ConversationSidebar";
import { EmptyChat } from "../components/chat/EmptyChat";
import { MessageList } from "../components/chat/MessageList";
import { SettingsPanel } from "../components/chat/SettingsPanel";
import { useChat } from "../hooks/useChat";
import { conversationTitle } from "../lib/format";
import { aiUiActions, aiUiSlice } from "../store/aiUiSlice";
import type { RunMode } from "../types/ai.types";

/**
 * /ai/chat and /ai/chat/:conversationId (one route with an optional segment, so the page
 * instance — and the composer text — survives "first message -> conversation created").
 *
 * Deep links: /ai/chat?profile=<id> opens a new agent chat with that profile preselected.
 */
export default function AiChatPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const ui = useSelector(aiUiSlice.selectors.selectAiUi);
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [params, setParams] = useSearchParams();

  const chat = useChat(conversationId as UUID | undefined);
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  // ?profile=<id> -> new agent chat preset
  const profileParam = params.get("profile");
  useEffect(() => {
    if (!profileParam || conversationId) return;
    chat.patchSettings({ mode: "agent", profile_id: profileParam as UUID });
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileParam, conversationId]);

  // close the settings drawer when switching conversations
  useEffect(() => {
    dispatch(aiUiActions.closeSettings());
    dispatch(aiUiActions.closeSidebar());
    setSendError(null);
  }, [conversationId, dispatch]);

  async function handleSend(attachmentIds: UUID[] = [], override?: string): Promise<boolean> {
    const content = override ?? text;
    setSendError(null);
    const res = await chat.send(content, attachmentIds);
    if (res.ok) {
      setText("");
      return true;
    }
    if (res.message || chat.sendBlock(content) === null) {
      setSendError(res.message ?? t("errors.unexpected", "Сталася неочікувана помилка"));
    }
    return false;
  }

  function retry() {
    const last = chat.lastUserMessage;
    if (!last) return;
    chat.dismissRun();
    void handleSend(
      last.attachments?.map((a) => a.id) ?? [],
      last.content,
    );
  }

  const notFound = Boolean(conversationId && chat.conversation.error && !chat.conversation.isLoading);
  const title = conversationId
    ? chat.conversation.data
      ? conversationTitle(chat.conversation.data)
      : t("common.loading", "Завантаження…")
    : t("ai.chat.newTitle", "Новий діалог");

  const mode = chat.settings.mode;
  const agentConversation = mode === "agent" || chat.conversation.data?.mode === "agent";
  const lost =
    chat.streamState.connection === "retrying" || chat.streamState.connection === "connecting";

  function pick(prompt: string, m: RunMode) {
    chat.patchSettings({ mode: m });
    setText(prompt);
  }

  return (
    <div className="space-y-4">
      <header className="min-w-0 space-y-1">
        <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
          {t("ai.title", "AI-асистент")}
        </h1>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          {t("ai.subtitle", "Чат з базами знань та автономний агент.")}
        </p>
      </header>

      <div className="relative flex h-[calc(100dvh-14rem)] min-h-130 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
        <ConversationSidebar />

        <section className="flex min-w-0 flex-1 flex-col" aria-label={title}>
          {/* conversation header */}
          <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5 dark:border-white/5">
            <button
              type="button"
              onClick={() => dispatch(aiUiActions.openSidebar())}
              aria-label={t("ai.sidebar.title", "Діалоги")}
              className={`${iconButton} md:hidden`}
            >
              <MenuIcon className="size-5" />
            </button>
            <h2 className="min-w-0 flex-1 truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
              {title}
            </h2>
            <Pill tone={agentConversation ? "brand" : "neutral"}>
              {agentConversation ? <BotIcon className="size-3.5" /> : <MessageIcon className="size-3.5" />}
              {agentConversation ? t("ai.mode.agent", "Агент") : t("ai.mode.chat", "Чат")}
            </Pill>
            <button
              type="button"
              onClick={() => dispatch(aiUiActions.toggleSettings())}
              aria-label={t("ai.composer.settings", "Налаштування")}
              aria-pressed={ui.settingsOpen}
              className={iconButton}
            >
              <SlidersIcon className="size-5" />
            </button>
          </div>

          {notFound ? (
            <div className="p-4">
              <Alert>
                {(chat.conversation.error as { message?: string }).message ??
                  t("ai.chat.notFound", "Діалог не знайдено")}
              </Alert>
            </div>
          ) : (
            <>
              <MessageList
                resetKey={conversationId ?? "new"}
                messages={chat.messages}
                loading={Boolean(conversationId) && chat.messagesLoading}
                error={
                  chat.messagesError
                    ? ((chat.messagesError as { message?: string }).message ??
                      t("ai.chat.loadError", "Не вдалося завантажити повідомлення"))
                    : null
                }
                canLoadEarlier={chat.canLoadEarlier}
                loadingEarlier={chat.loadingEarlier}
                onLoadEarlier={chat.loadEarlier}
                agentConversation={agentConversation}
                liveRun={chat.liveRun}
                connectionLost={lost}
                streamError={chat.streamState.streamError}
                onRetry={chat.lastUserMessage ? retry : undefined}
                onDismissRun={chat.dismissRun}
                empty={<EmptyChat onPick={pick} />}
              />

              <Composer
                value={text}
                onChange={(v) => {
                  setText(v);
                  if (sendError) setSendError(null);
                }}
                onSend={(attachmentIds) => handleSend(attachmentIds)}
                onUploadAttachment={chat.uploadAttachment}
                onDeleteAttachment={chat.deleteAttachment}
                isUploadingAttachment={chat.isUploadingAttachment}
                onStop={() => void chat.stop()}
                isRunActive={chat.isRunActive}
                isSending={chat.isStarting}
                isStopping={chat.isStopping}
                block={chat.sendBlock(text)}
                settings={chat.settings}
                capabilities={chat.capabilities.data}
                hasDraft={chat.hasDraft}
                onPatchSettings={chat.patchSettings}
                onToggleSettings={() => dispatch(aiUiActions.toggleSettings())}
                settingsOpen={ui.settingsOpen}
                autoFocusKey={conversationId ?? "new"}
                banner={sendError ? <Alert>{sendError}</Alert> : undefined}
              />
            </>
          )}
        </section>

        {ui.settingsOpen && (
          <SettingsPanel
            settings={chat.settings}
            capabilities={chat.capabilities.data}
            onPatch={chat.patchSettings}
            onClose={() => dispatch(aiUiActions.closeSettings())}
          />
        )}
      </div>
    </div>
  );
}
