import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { MAX_MESSAGE_LENGTH } from "../../constants/ai.constants";
import type { SendBlock } from "../../hooks/useChat";
import type {
  Capabilities,
  ConversationSettings,
  RunMode,
} from "../../types/ai.types";
import {
  BotIcon,
  FolderIcon,
  GlobeIcon,
  MessageIcon,
  SendIcon,
  SlidersIcon,
  SpinnerIcon,
  StopIcon,
} from "../AiIcons";
import { focusRing, Segmented } from "../AiUi";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  isRunActive: boolean;
  isSending: boolean;
  isStopping: boolean;
  block: SendBlock;
  settings: ConversationSettings;
  capabilities: Capabilities | undefined;
  hasDraft: boolean;
  onPatchSettings: (patch: Partial<ConversationSettings>) => void;
  onToggleSettings: () => void;
  settingsOpen: boolean;
  /** Extra content above the input (errors). */
  banner?: ReactNode;
  autoFocusKey: string;
}

const chipBase = `inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-theme-xs font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;
const chipOff =
  "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-gray-400 dark:hover:bg-white/5";
const chipOn =
  "border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100/70 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300";

function Chip({
  active,
  onClick,
  icon,
  children,
  disabled,
  title,
  pressed,
}: {
  active?: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={pressed}
      className={`${chipBase} ${active ? chipOn : chipOff}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  isRunActive,
  isSending,
  isStopping,
  block,
  settings,
  capabilities,
  hasDraft,
  onPatchSettings,
  onToggleSettings,
  settingsOpen,
  banner,
  autoFocusKey,
}: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // auto-grow up to ~8 lines
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 208)}px`;
  }, [value]);

  // focus when switching conversations / starting a new chat
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [autoFocusKey]);

  const agentAvailable = capabilities?.modes.includes("agent") ?? true;
  const webAvailable = capabilities?.tools.some((x) => x.name === "web_search") ?? false;
  const canSend = block === null && !isSending;

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) onSend();
    }
  }

  const blockText: Record<Exclude<SendBlock, null | "empty">, string> = {
    tooLong: t("ai.composer.tooLong", "Повідомлення задовге (максимум {{max}} символів).", {
      max: MAX_MESSAGE_LENGTH,
    }),
    noCollections: t(
      "ai.composer.noCollections",
      "Оберіть хоча б одну колекцію або режим «Усі доступні».",
    ),
    busy: t("ai.composer.busy", "Дочекайтесь відповіді або зупиніть її."),
    noAgentModel: t(
      "ai.composer.noAgentModel",
      "Для режиму агента потрібна модель із підтримкою інструментів.",
    ),
  };
  const hint = block && block !== "empty" && block !== "busy" ? blockText[block] : null;

  const modeOptions: { value: RunMode; label: string; icon: ReactNode; disabled?: boolean }[] = [
    { value: "chat", label: t("ai.mode.chat", "Чат"), icon: <MessageIcon className="size-4" /> },
    {
      value: "agent",
      label: t("ai.mode.agent", "Агент"),
      icon: <BotIcon className="size-4" />,
      disabled: !agentAvailable,
    },
  ];

  const scopeLabel =
    settings.collection_ids === null
      ? t("ai.composer.allCollections", "Усі колекції")
      : t("ai.composer.nCollections", "Колекції: {{count}}", {
          count: settings.collection_ids.length,
        });

  return (
    <div className="border-t border-gray-100 bg-white/80 px-3 pt-3 pb-3 backdrop-blur sm:px-4 dark:border-white/5 dark:bg-transparent">
      <div className="mx-auto w-full max-w-3xl space-y-2.5">
        {banner}

        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            size="sm"
            label={t("ai.mode.label", "Режим")}
            value={settings.mode}
            onChange={(mode) => onPatchSettings({ mode })}
            options={modeOptions}
          />
          <Chip
            pressed={settings.rag_enabled}
            active={settings.rag_enabled}
            onClick={() => onPatchSettings({ rag_enabled: !settings.rag_enabled })}
            icon={<FolderIcon className="size-4" />}
            title={t("ai.composer.ragHint", "Шукати відповіді в базах знань")}
          >
            {settings.rag_enabled
              ? scopeLabel
              : t("ai.composer.knowledge", "База знань")}
          </Chip>
          {webAvailable && (
            <Chip
              pressed={settings.web_enabled}
              active={settings.web_enabled}
              disabled={settings.mode !== "agent"}
              onClick={() => onPatchSettings({ web_enabled: !settings.web_enabled })}
              icon={<GlobeIcon className="size-4" />}
              title={
                settings.mode === "agent"
                  ? t("ai.composer.webHint", "Дозволити агенту шукати в інтернеті")
                  : t("ai.composer.webAgentOnly", "Інтернет-пошук доступний у режимі агента")
              }
            >
              {t("ai.composer.web", "Інтернет")}
            </Chip>
          )}
          <Chip
            pressed={settingsOpen}
            active={settingsOpen || hasDraft}
            onClick={onToggleSettings}
            icon={<SlidersIcon className="size-4" />}
          >
            {t("ai.composer.settings", "Налаштування")}
          </Chip>
        </div>

        <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-xs transition-colors focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-500/15 dark:border-white/10 dark:bg-white/3 dark:focus-within:border-brand-500/40 dark:focus-within:ring-brand-500/10">
          <label htmlFor="ai-composer" className="sr-only">
            {t("ai.composer.label", "Повідомлення")}
          </label>
          <textarea
            id="ai-composer"
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              settings.mode === "agent"
                ? t("ai.composer.placeholderAgent", "Опишіть завдання для агента…")
                : t("ai.composer.placeholder", "Поставте запитання…")
            }
            className="max-h-52 min-h-10 w-full flex-1 resize-none bg-transparent px-2.5 py-2 text-theme-sm leading-6 text-gray-800 outline-none placeholder:text-gray-400 dark:text-white/90 dark:placeholder:text-gray-500"
            aria-invalid={block === "tooLong"}
          />

          {isRunActive ? (
            <button
              type="button"
              onClick={onStop}
              disabled={isStopping}
              aria-label={t("ai.composer.stop", "Зупинити генерацію")}
              title={t("ai.composer.stop", "Зупинити генерацію")}
              className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white transition-colors hover:bg-gray-700 disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 ${focusRing}`}
            >
              {isStopping ? <SpinnerIcon className="size-4.5" /> : <StopIcon className="size-4" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              aria-label={t("ai.composer.send", "Надіслати")}
              title={t("ai.composer.send", "Надіслати")}
              className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-xs transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none dark:disabled:bg-white/10 dark:disabled:text-gray-500 ${focusRing}`}
            >
              {isSending ? <SpinnerIcon className="size-4.5" /> : <SendIcon className="size-5" />}
            </button>
          )}
        </div>

        <div className="flex min-h-4 items-center justify-between gap-3 px-1">
          <p
            role={hint ? "alert" : undefined}
            className={`text-theme-xs ${hint ? "text-warning-600 dark:text-warning-400" : "text-gray-400 dark:text-gray-500"}`}
          >
            {hint ?? (
              <span className="hidden sm:inline">
                {t("ai.composer.keys", "Enter — надіслати · Shift+Enter — новий рядок")}
              </span>
            )}
          </p>
          {value.length > MAX_MESSAGE_LENGTH * 0.8 && (
            <span
              className={`text-theme-xs tabular-nums ${
                value.length > MAX_MESSAGE_LENGTH
                  ? "text-error-600 dark:text-error-400"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              {value.length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
