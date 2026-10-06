import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { Field } from "@/shared/ui/Field";
import { Modal } from "@/shared/ui/Modal";
import { btnPrimary, btnSecondary, inputClass } from "@/shared/ui/classes";
import type { UUID } from "@/shared/types/api";
import { useCreateProfileMutation, useGetCapabilitiesQuery } from "../../api/ai.endpoints";
import { PlusIcon, SpinnerIcon, btnContent } from "../AiIcons";
import { Pill } from "../AiUi";
import { CollectionPicker } from "../CollectionPicker";

interface Props {
  onClose: () => void;
  onCreated?: () => void;
}

interface Values {
  name: string;
  description: string;
  promptId: string;
  model: string;
  tools: string[];
  collections: UUID[];
  maxSteps: number;
}

export function ProfileFormModal({ onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const caps = useGetCapabilitiesQuery();
  const [create, { isLoading }] = useCreateProfileMutation();

  const prompts = useMemo(
    () => (caps.data?.prompts ?? []).filter((p) => p.kind === "agent_system" && !p.is_archived),
    [caps.data],
  );
  const models = useMemo(() => (caps.data?.models ?? []).filter((m) => m.tools), [caps.data]);
  const tools = caps.data?.tools ?? [];
  const maxStepsCap = Math.min(50, caps.data?.limits.max_steps ?? 50);

  const [v, setV] = useState<Values>({
    name: "",
    description: "",
    promptId: "",
    model: "",
    // read-only tools preselected; write tools must be opted into consciously
    tools: [],
    collections: [],
    maxSteps: 8,
  });
  const [touchedTools, setTouchedTools] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const effectiveTools = touchedTools
    ? v.tools
    : tools.filter((x) => x.risk === "read").map((x) => x.name);
  const effectivePrompt = v.promptId || prompts[0]?.id || "";

  const set = <K extends keyof Values>(k: K, val: Values[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((p) => {
      if (!p[k as string]) return p;
      const n = { ...p };
      delete n[k as string];
      return n;
    });
    if (formError) setFormError(null);
  };

  const toggleTool = (name: string) => {
    setTouchedTools(true);
    set(
      "tools",
      effectiveTools.includes(name)
        ? effectiveTools.filter((x) => x !== name)
        : [...effectiveTools, name],
    );
  };

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!v.name.trim()) e.name = t("ai.agents.form.nameRequired", "Назва обов'язкова");
    else if (v.name.length > 255) e.name = t("ai.agents.form.nameMax", "Максимальна довжина — 255 символів");
    if (!effectivePrompt) e.promptId = t("ai.agents.form.promptRequired", "Оберіть системний промпт");
    setErrors(e);
    if (Object.keys(e).length) return;

    try {
      await create({
        name: v.name.trim(),
        description: v.description.trim() || null,
        prompt_template_id: effectivePrompt as UUID,
        model: v.model || null,
        allowed_tools: effectiveTools,
        default_collection_ids: v.collections,
        max_steps: v.maxSteps,
      }).unwrap();
      onCreated?.();
      onClose();
    } catch (err) {
      setFormError(
        isNormalizedApiError(err) ? err.message : t("errors.unexpected", "Сталася неочікувана помилка"),
      );
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("ai.agents.form.title", "Новий профіль агента")}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            className={`${btnSecondary} ${btnContent} w-full sm:w-auto`}
            onClick={onClose}
            disabled={isLoading}
          >
            {t("common.cancel", "Скасувати")}
          </button>
          <button
            type="submit"
            form="ai-profile-form"
            disabled={isLoading || caps.isLoading}
            className={`${btnPrimary} ${btnContent} w-full sm:w-auto sm:min-w-32`}
          >
            {isLoading ? <SpinnerIcon /> : <PlusIcon />}
            {isLoading ? t("common.saving", "Збереження…") : t("common.create", "Створити")}
          </button>
        </div>
      }
    >
      <form id="ai-profile-form" onSubmit={submit} noValidate className="space-y-5">
        <p className="text-theme-sm leading-5 text-gray-500 dark:text-gray-400">
          {t(
            "ai.agents.form.description",
            "Профіль задає промпт, модель і набір інструментів, яким агент може користуватися.",
          )}
        </p>
        {formError && <Alert>{formError}</Alert>}
        {caps.error && <Alert>{t("ai.agents.capsError", "Не вдалося завантажити можливості сервера")}</Alert>}

        <Field label={t("ai.agents.form.name", "Назва")} error={errors.name}>
          <input
            className={`${inputClass} w-full`}
            value={v.name}
            maxLength={255}
            onChange={(e) => set("name", e.target.value)}
            placeholder={t("ai.agents.form.namePlaceholder", "Наприклад, Аналітик документів")}
            autoComplete="off"
            autoFocus
            aria-invalid={Boolean(errors.name)}
          />
        </Field>

        <Field label={t("ai.agents.form.descriptionLabel", "Опис")}>
          <textarea
            className={`${inputClass} min-h-20 w-full resize-y`}
            rows={3}
            value={v.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={2000}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("ai.agents.form.prompt", "Системний промпт")} error={errors.promptId}>
            <select
              className={`${inputClass} h-10 w-full`}
              value={effectivePrompt}
              onChange={(e) => set("promptId", e.target.value)}
            >
              {prompts.length === 0 && <option value="">—</option>}
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("ai.agents.form.model", "Модель")}>
            <select
              className={`${inputClass} h-10 w-full`}
              value={v.model}
              onChange={(e) => set("model", e.target.value)}
            >
              <option value="">{t("ai.settings.defaultModel", "За замовчуванням")}</option>
              {models.map((m) => (
                <option key={m.alias} value={m.alias}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
            {t("ai.agents.form.tools", "Дозволені інструменти")}
          </legend>
          <ul className="space-y-1.5">
            {tools.map((tool) => {
              const checked = effectiveTools.includes(tool.name);
              return (
                <li key={tool.name}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3 transition-colors hover:bg-gray-50 has-checked:border-brand-500 has-checked:bg-brand-50/40 has-focus-visible:ring-2 has-focus-visible:ring-brand-500/40 dark:border-white/10 dark:hover:bg-white/5 dark:has-checked:border-brand-400 dark:has-checked:bg-brand-500/10">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTool(tool.name)}
                      className="mt-0.5 size-4 shrink-0 rounded border-gray-300 text-brand-500 focus:ring-brand-500/40 dark:border-white/20 dark:bg-transparent"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <code className="font-mono text-theme-xs font-semibold text-gray-800 dark:text-white/90">
                          {tool.name}
                        </code>
                        {tool.risk === "write" && (
                          <Pill tone="warning">{t("ai.agents.writeTool", "змінює дані")}</Pill>
                        )}
                        {tool.requires_rag && (
                          <Pill>{t("ai.agents.requiresRag", "потребує бази знань")}</Pill>
                        )}
                      </span>
                      <span className="mt-0.5 block text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
                        {tool.description}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <Field label={t("ai.agents.form.collections", "Колекції за замовчуванням")}>
          <CollectionPicker
            value={v.collections}
            onChange={(ids) => set("collections", ids)}
            label={t("ai.agents.form.collections", "Колекції за замовчуванням")}
            maxHeightClass="max-h-40"
          />
        </Field>

        <Field label={t("ai.agents.form.maxSteps", "Максимум кроків")}>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={maxStepsCap}
              value={v.maxSteps}
              onChange={(e) => set("maxSteps", Number(e.target.value))}
              className="h-2 flex-1 cursor-pointer accent-brand-500"
              aria-label={t("ai.agents.form.maxSteps", "Максимум кроків")}
            />
            <span className="w-8 text-end text-theme-sm font-medium tabular-nums text-gray-800 dark:text-white/90">
              {v.maxSteps}
            </span>
          </div>
        </Field>
      </form>
    </Modal>
  );
}
