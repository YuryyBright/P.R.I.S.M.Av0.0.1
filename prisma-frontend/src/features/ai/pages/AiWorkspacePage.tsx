import { useMemo, useState } from "react";
import {
  useCancelAiRunMutation,
  useStartAiRunMutation,
} from "../api/ai.endpoints";
import { DEFAULT_AI_CONFIG } from "../constants/ai.constants";
import { useAiRunStream } from "../hooks/useAiRunStream";
import { AgentToolsPanel } from "../components/AgentToolsPanel";
import { ChatComposer } from "../components/ChatComposer";
import { ChatHistory } from "../components/ChatHistory";
import { KnowledgePanel } from "../components/KnowledgePanel";
import { ModeTabs } from "../components/ModeTabs";
import { RunTimeline } from "../components/RunTimeline";
import { SourceDrawer } from "../components/SourceDrawer";
import type {
  AiAttachment,
  AiChat,
  AiCitation,
  AiMode,
  AiRunConfig,
} from "../types/ai.types";

export default function AiWorkspacePage() {
  const [chats, setChats] = useState<AiChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>();

  const [mode, setMode] = useState<AiMode>("chat");

  const [config, setConfig] = useState<AiRunConfig>({
    ...DEFAULT_AI_CONFIG,
    mode: "chat",
  });

  const [attachments, setAttachments] = useState<AiAttachment[]>([]);
  const [runId, setRunId] = useState<string>();
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<AiCitation[]>([]);

  const [startRun, { isLoading: starting }] = useStartAiRunMutation();
  const [cancelRun, { isLoading: cancelling }] = useCancelAiRunMutation();

  const { events, connected } = useAiRunStream(runId);

  const running = starting || cancelling || connected;

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId),
    [chats, activeChatId],
  );

  const liveText = useMemo(
    () =>
      events
        .filter((event) => event.type === "llm.delta")
        .map((event) => String((event.data as { text?: string }).text ?? ""))
        .join(""),
    [events],
  );

  const effectiveAnswer = liveText || answer;

  function createNewChat() {
    const now = new Date().toISOString();

    const chat: AiChat = {
      id: crypto.randomUUID(),
      title: "New chat",
      createdAt: now,
      updatedAt: now,
    };

    setChats((current) => [chat, ...current]);
    setActiveChatId(chat.id);

    setRunId(undefined);
    setAnswer("");
    setCitations([]);
    setAttachments([]);
  }

  function selectChat(chatId: string) {
    setActiveChatId(chatId);

    setRunId(undefined);
    setAnswer("");
    setCitations([]);
    setAttachments([]);
  }

  async function submit(message: string) {
    setAnswer("");
    setCitations([]);

    const nextConfig: AiRunConfig = {
      ...config,
      mode,
    };

    const result = await startRun({
      chatId: activeChatId,
      message,
      config: nextConfig,
      attachments: attachments
        .map((item) => item.file)
        .filter((file): file is File => Boolean(file)),
    }).unwrap();

    setRunId(result.id);
    setAttachments([]);

    /*
     * Backend integration will update the chat title and
     * messages in a later step.
     */
  }

  async function stop() {
    if (!runId) {
      return;
    }

    await cancelRun(runId).unwrap();
  }

  function patchConfig(patch: Partial<AiRunConfig>) {
    setConfig((current) => ({
      ...current,
      ...patch,
    }));
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-[1700px] flex-col gap-4">
      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.18em] text-gray-500 uppercase dark:text-gray-400">
            AI Workspace
          </p>

          <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            Chat & Agent
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
            Один інтерфейс для multimodal chat, RAG retrieval, reranking та
            tool-using agents.
          </p>
        </div>

        <div className="shrink-0">
          <ModeTabs
            value={mode}
            onChange={(next) => {
              setMode(next);
              patchConfig({ mode: next });
            }}
          />
        </div>
      </header>

      {/* Workspace */}
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[240px_minmax(0,1fr)_340px]">
        {/* Chat history */}
        <div className="min-h-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <ChatHistory
            chats={chats}
            activeChatId={activeChatId}
            onSelect={selectChat}
            onNewChat={createNewChat}
          />
        </div>

        {/* Conversation */}
        <main className="flex min-h-[680px] min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {/* Conversation header */}
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">
                {activeChat
                  ? activeChat.title
                  : mode === "chat"
                    ? "New conversation"
                    : "New agent run"}
              </p>

              <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
                {runId ? `Run ${runId}` : "Новий run"}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                className={[
                  "size-2 rounded-full",
                  connected ? "bg-success-500" : "bg-gray-300 dark:bg-gray-600",
                ].join(" ")}
              />

              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {connected ? "streaming" : "idle"}
              </span>

              {running && (
                <button
                  type="button"
                  onClick={() => void stop()}
                  className="ml-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 focus:ring-2 focus:ring-brand-500/10 focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Stop
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
            {effectiveAnswer ? (
              <div className="ml-auto max-w-3xl rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 text-sm leading-6 text-gray-800 dark:border-gray-800 dark:bg-gray-800 dark:text-white/90">
                {effectiveAnswer}
              </div>
            ) : (
              <div className="grid min-h-80 place-items-center px-4 py-8 text-center">
                <div className="max-w-md">
                  <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                    AI
                  </div>

                  <h2 className="mt-4 text-lg font-semibold text-gray-800 dark:text-white/90">
                    {mode === "chat" ? "Почнемо розмову" : "Запусти agent run"}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                    Додай файли або задай питання. У правій панелі можна окремо
                    керувати RAG, reranker та tools.
                  </p>
                </div>
              </div>
            )}

            <RunTimeline events={events} />

            <SourceDrawer
              events={events}
              streamingText={liveText}
              citations={citations}
            />
          </div>

          {/* Composer */}
          <div className="shrink-0 border-t border-gray-100 p-4 dark:border-gray-800">
            <ChatComposer
              disabled={running}
              attachments={attachments}
              onAttachments={setAttachments}
              onSubmit={(message) => void submit(message)}
            />
          </div>
        </main>

        {/* Configuration */}
        <aside className="min-w-0 space-y-4">
          {/* Run configuration */}
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
                Run configuration
              </p>

              <p className="mt-1 text-[11px] leading-5 text-gray-500 dark:text-gray-400">
                Snapshot конфігурації зберігається разом із run.
              </p>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">
                  Model
                </span>

                <select
                  value={config.model}
                  onChange={(event) =>
                    patchConfig({
                      model: event.target.value,
                    })
                  }
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 transition outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:focus:border-brand-500"
                >
                  <option value="default">Default</option>
                  <option value="qwen3">Qwen / vLLM</option>
                  <option value="vision">Vision model</option>
                </select>
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Temperature
                  </span>

                  <input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={config.temperature}
                    onChange={(event) =>
                      patchConfig({
                        temperature: Number(event.target.value),
                      })
                    }
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 transition outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:focus:border-brand-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Max tokens
                  </span>

                  <input
                    type="number"
                    min={128}
                    max={32768}
                    value={config.maxOutputTokens}
                    onChange={(event) =>
                      patchConfig({
                        maxOutputTokens: Number(event.target.value),
                      })
                    }
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 transition outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:focus:border-brand-500"
                  />
                </label>
              </div>
            </div>
          </section>

          {/* Knowledge */}
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <KnowledgePanel
              ragEnabled={config.ragEnabled}
              rerankerEnabled={config.rerankerEnabled}
              collectionIds={config.collectionIds}
              topK={config.topK}
              rerankTopK={config.rerankTopK}
              onChange={(patch) => patchConfig(patch as Partial<AiRunConfig>)}
            />
          </section>

          {/* Agent tools */}
          {mode === "agent" && (
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <AgentToolsPanel
                selected={config.allowedTools ?? []}
                onChange={(allowedTools) =>
                  patchConfig({
                    allowedTools,
                  })
                }
              />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
