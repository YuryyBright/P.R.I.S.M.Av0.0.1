import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { inputClass } from "@/shared/ui/classes";
import type { UUID } from "@/shared/types/api";
import { AI_ROUTES } from "../../constants/ai.constants";
import type { Capabilities, ConversationSettings } from "../../types/ai.types";
import { BotIcon, MessageIcon, SlidersIcon, XIcon } from "../AiIcons";
import { CollectionPicker } from "../CollectionPicker";
import { iconButton, PanelSection, Switch, focusRing } from "../AiUi";

interface Props {
  settings: ConversationSettings;
  capabilities: Capabilities | undefined;
  onPatch: (patch: Partial<ConversationSettings>) => void;
  onClose: () => void;
}

const selectClass = `${inputClass} h-10 w-full`;
const ANIMATION_MS = 200;

function Field({
  id,
  label,
  children,
  hint,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">{hint}</p>
      )}
    </div>
  );
}

/** Section wrapped in a soft card so the drawer is easier to scan. */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 rounded-2xl border border-gray-100 bg-white p-3.5 dark:border-white/5 dark:bg-white/3">
      {children}
    </div>
  );
}

function CollectionScope({
  settings,
  onPatch,
}: Pick<Props, "settings" | "onPatch">) {
  const { t } = useTranslation();
  const selected = settings.collection_ids;
  const all = selected === null;

  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label={t("ai.settings.scope", "Область пошуку")}
        className="grid grid-cols-2 gap-2"
      >
        {[
          { v: true, label: t("ai.settings.scopeAll", "Усі доступні") },
          { v: false, label: t("ai.settings.scopeSelected", "Вибрані") },
        ].map((o) => {
          const active = all === o.v;
          return (
            <button
              key={String(o.v)}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() =>
                onPatch({ collection_ids: o.v ? null : (selected ?? []) })
              }
              className={`h-9 rounded-lg border text-theme-sm font-medium transition-colors ${focusRing} ${
                active
                  ? "border-brand-500 bg-brand-50/60 text-brand-700 ring-1 ring-brand-500/30 dark:border-brand-400 dark:bg-brand-500/10 dark:text-brand-300"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {!all && (
        <>
          <CollectionPicker
            value={selected ?? []}
            onChange={(ids) => onPatch({ collection_ids: ids })}
            label={t("ai.settings.scopeSelected", "Вибрані")}
          />
          {selected && selected.length === 0 && (
            <p
              role="alert"
              className="text-theme-xs text-warning-600 dark:text-warning-400"
            >
              {t(
                "ai.composer.noCollections",
                "Оберіть хоча б одну колекцію або режим «Усі доступні».",
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function SettingsPanel({
  settings,
  capabilities,
  onPatch,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const isAgent = settings.mode === "agent";

  /* ───────── slide in / slide out ───────── */
  const [shown, setShown] = useState(false);
  const closeBtn = useRef<HTMLButtonElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    closeBtn.current?.focus({ preventScroll: true });
    return () => {
      cancelAnimationFrame(raf);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const requestClose = useCallback(() => {
    setShown(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(onClose, ANIMATION_MS);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose]);

  /* ───────── data ───────── */
  const models = useMemo(
    () => (capabilities?.models ?? []).filter((m) => !isAgent || m.tools),
    [capabilities, isAgent],
  );
  const profiles = capabilities?.profiles ?? [];
  const prompts = useMemo(
    () =>
      (capabilities?.prompts ?? []).filter(
        (p) =>
          !p.is_archived &&
          p.kind === (isAgent ? "agent_system" : "chat_system"),
      ),
    [capabilities, isAgent],
  );
  const defaultModel = capabilities?.models.find((m) => m.default);
  const reranker = capabilities?.reranker;

  return (
    <>
      {/* backdrop */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("common.close", "Закрити")}
        onClick={requestClose}
        className={`absolute inset-0 z-20 cursor-default bg-gray-900/40 backdrop-blur-[1px] transition-opacity duration-200 motion-reduce:transition-none ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("ai.settings.title", "Налаштування діалогу")}
        className={`absolute inset-y-0 end-0 z-30 flex w-full max-w-full flex-col border-s border-gray-200 bg-gray-50 shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none sm:w-96 dark:border-white/10 dark:bg-gray-900 ${
          shown ? "translate-x-0" : "translate-x-full rtl:-translate-x-full"
        }`}
      >
        <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-gray-900">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
          >
            <SlidersIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-theme-sm font-semibold text-gray-800 dark:text-white/90">
              {t("ai.settings.title", "Налаштування діалогу")}
            </h2>
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
              {isAgent ? (
                <BotIcon className="size-3.5" />
              ) : (
                <MessageIcon className="size-3.5" />
              )}
              {isAgent ? t("ai.mode.agent", "Агент") : t("ai.mode.chat", "Чат")}
            </p>
          </div>
          <button
            ref={closeBtn}
            type="button"
            onClick={requestClose}
            aria-label={t("common.close", "Закрити")}
            className={iconButton}
          >
            <XIcon className="size-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <p className="mb-3 rounded-xl bg-brand-50/60 px-3 py-2 text-theme-xs leading-5 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            {t(
              "ai.settings.applied",
              "Зміни застосуються до наступного повідомлення й збережуться в діалозі.",
            )}
          </p>

          <Card>
            <PanelSection title={t("ai.settings.model", "Модель")}>
              <Field
                id="ai-model"
                label={t("ai.settings.modelLabel", "Модель відповіді")}
                hint={
                  isAgent
                    ? t(
                        "ai.settings.modelAgentHint",
                        "Для агента доступні лише моделі з підтримкою інструментів.",
                      )
                    : undefined
                }
              >
                <select
                  id="ai-model"
                  className={selectClass}
                  value={settings.model ?? ""}
                  onChange={(e) => onPatch({ model: e.target.value || null })}
                >
                  <option value="">
                    {defaultModel
                      ? t(
                          "ai.settings.defaultModelNamed",
                          "За замовчуванням ({name})",
                          { name: defaultModel.label },
                        )
                      : t("ai.settings.defaultModel", "За замовчуванням")}
                  </option>
                  {models.map((m) => (
                    <option key={m.alias} value={m.alias}>
                      {m.label}
                      {m.vision ? " · vision" : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </PanelSection>
          </Card>

          {isAgent && (
            <Card>
              <PanelSection
                title={t("ai.settings.agent", "Агент")}
                aside={
                  <Link
                    to={AI_ROUTES.agents}
                    className="rounded text-theme-xs font-medium text-brand-600 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:text-brand-400"
                  >
                    {t("ai.settings.manageProfiles", "Керувати")}
                  </Link>
                }
              >
                <Field
                  id="ai-profile"
                  label={t("ai.settings.profile", "Профіль агента")}
                >
                  <select
                    id="ai-profile"
                    className={selectClass}
                    value={settings.profile_id ?? ""}
                    onChange={(e) =>
                      onPatch({
                        profile_id: (e.target.value || null) as UUID | null,
                      })
                    }
                  >
                    <option value="">
                      {t(
                        "ai.settings.noProfile",
                        "Без профілю (усі інструменти)",
                      )}
                    </option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Switch
                  checked={settings.web_enabled}
                  onChange={(web_enabled) => onPatch({ web_enabled })}
                  label={t("ai.settings.web", "Пошук в інтернеті")}
                  hint={t(
                    "ai.settings.webHint",
                    "Лише читання. Агент не виконує довільних HTTP-запитів.",
                  )}
                  disabled={
                    !capabilities?.tools.some((x) => x.name === "web_search")
                  }
                />
              </PanelSection>
            </Card>
          )}

          <Card>
            <PanelSection title={t("ai.settings.knowledge", "База знань")}>
              <Switch
                checked={settings.rag_enabled}
                onChange={(rag_enabled) => onPatch({ rag_enabled })}
                label={t("ai.settings.rag", "Шукати в колекціях")}
                hint={t(
                  "ai.settings.ragHint",
                  "Доступ до документів визначається вашими правами.",
                )}
              />
              {settings.rag_enabled && (
                <CollectionScope settings={settings} onPatch={onPatch} />
              )}
            </PanelSection>
          </Card>

          {settings.rag_enabled && reranker && (
            <Card>
              <PanelSection title={t("ai.settings.reranker", "Переранжування")}>
                <Switch
                  checked={settings.reranker.enabled && reranker.available}
                  onChange={(enabled) =>
                    onPatch({ reranker: { ...settings.reranker, enabled } })
                  }
                  disabled={!reranker.available}
                  label={t(
                    "ai.settings.rerankerOn",
                    "Покращити порядок джерел",
                  )}
                  hint={
                    reranker.available
                      ? t(
                          "ai.settings.rerankerHint",
                          "Точніше, але трохи повільніше.",
                        )
                      : t(
                          "ai.settings.rerankerOff",
                          "Reranker недоступний на сервері.",
                        )
                  }
                />
                {settings.reranker.enabled && reranker.available && (
                  <Field
                    id="ai-rerank-topk"
                    label={t("ai.settings.topK", "Кількість джерел (top-k)")}
                  >
                    <input
                      id="ai-rerank-topk"
                      type="number"
                      min={1}
                      max={20}
                      inputMode="numeric"
                      className={`${inputClass} h-10 w-28`}
                      value={settings.reranker.top_k ?? ""}
                      placeholder={String(reranker.default_top_k)}
                      onChange={(e) => {
                        const n =
                          e.target.value === ""
                            ? null
                            : Math.min(20, Math.max(1, Number(e.target.value)));
                        onPatch({
                          reranker: { ...settings.reranker, top_k: n },
                        });
                      }}
                    />
                  </Field>
                )}
              </PanelSection>
            </Card>
          )}

          {prompts.length > 0 && (
            <Card>
              <PanelSection title={t("ai.settings.prompt", "Системний промпт")}>
                <Field
                  id="ai-prompt"
                  label={t("ai.settings.promptLabel", "Шаблон")}
                >
                  <select
                    id="ai-prompt"
                    className={selectClass}
                    value={settings.prompt_template_id ?? ""}
                    onChange={(e) =>
                      onPatch({
                        prompt_template_id: (e.target.value ||
                          null) as UUID | null,
                        prompt_version_id: null,
                      })
                    }
                  >
                    <option value="">
                      {t("ai.settings.promptDefault", "За замовчуванням")}
                    </option>
                    {prompts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </PanelSection>
            </Card>
          )}
        </div>

        <footer className="border-t border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-gray-900">
          <button
            type="button"
            onClick={requestClose}
            className={`inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand-500 px-4 text-theme-sm font-medium text-white shadow-xs transition-colors hover:bg-brand-600 ${focusRing}`}
          >
            {t("common.done", "Готово")}
          </button>
        </footer>
      </aside>
    </>
  );
}
