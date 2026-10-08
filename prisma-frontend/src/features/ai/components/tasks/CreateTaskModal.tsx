import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { Field } from "@/shared/ui/Field";
import { Modal } from "@/shared/ui/Modal";
import { btnPrimary, btnSecondary, inputClass } from "@/shared/ui/classes";
import type { UUID } from "@/shared/types/api";
import { useCreateTaskMutation } from "../../api/ai.endpoints";
import {
  AI_ROUTES,
  TASK_FORMAT_OPTIONS,
  TASK_TYPE_OPTIONS,
} from "../../constants/ai.constants";
import type { TaskType } from "../../types/ai.types";
import { CheckIcon, PlusIcon, SpinnerIcon, btnContent } from "../AiIcons";
import { CollectionPicker } from "../CollectionPicker";

interface Props {
  onClose: () => void;
}

/** Types that only make sense over concrete documents. */
const NEEDS_SOURCES: TaskType[] = [
  "analysis",
  "document_processing",
  "dataset_processing",
  "report_generation",
];

interface Values {
  title: string;
  instruction: string;
  type: TaskType;
  collections: UUID[];
  formats: string[];
  batchSize: string;
  maxDocuments: string;
  itemRetries: string;
  focus: string;
}

const initial: Values = {
  title: "",
  instruction: "",
  type: "analysis",
  collections: [],
  formats: ["markdown"],
  batchSize: "",
  maxDocuments: "",
  itemRetries: "",
  focus: "",
};

const intOrUndefined = (v: string, min: number, max: number): number | undefined => {
  if (v.trim() === "") return undefined;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined;
};

export function CreateTaskModal({ onClose }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [create, { isLoading }] = useCreateTaskMutation();
  const [v, setV] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

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

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!v.instruction.trim())
      e.instruction = t("ai.tasks.form.instructionRequired", "Опишіть, що потрібно зробити");
    else if (v.instruction.length > 32000)
      e.instruction = t("ai.tasks.form.instructionMax", "Максимальна довжина — 32000 символів");
    if (v.title.length > 255)
      e.title = t("ai.tasks.form.titleMax", "Максимальна довжина — 255 символів");
    if (NEEDS_SOURCES.includes(v.type) && v.collections.length === 0)
      e.sources = t("ai.tasks.form.sourcesRequired", "Оберіть хоча б одну колекцію");
    if (v.formats.length === 0)
      e.formats = t("ai.tasks.form.formatsRequired", "Оберіть хоча б один формат результату");
    return e;
  }

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setFormError(null);
    const local = validate();
    setErrors(local);
    if (Object.keys(local).length) return;

    const focus = v.focus
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const config: Record<string, unknown> = {};
    const batch = intOrUndefined(v.batchSize, 1, 100);
    const maxDocs = intOrUndefined(v.maxDocuments, 1, 100000);
    const retries = intOrUndefined(v.itemRetries, 0, 10);
    if (batch !== undefined) config.batch_size = batch;
    if (maxDocs !== undefined) config.max_documents = maxDocs;
    if (retries !== undefined) config.item_retries = retries;
    if (focus.length) config.focus = focus;

    try {
      const res = await create({
        instruction: v.instruction.trim(),
        type: v.type,
        title: v.title.trim() || null,
        sources: v.collections.map((id) => ({ type: "rag_collection", id, metadata: {} })),
        config,
        output: { formats: v.formats },
      }).unwrap();
      onClose();
      navigate(AI_ROUTES.taskDetail(res.task_id));
    } catch (e) {
      setFormError(
        isNormalizedApiError(e) ? e.message : t("errors.unexpected", "Сталася неочікувана помилка"),
      );
    }
  }

  const typeHint = TASK_TYPE_OPTIONS.find((o) => o.value === v.type)?.hint;

  return (
    <Modal
      open
      onClose={onClose}
      title={t("ai.tasks.form.title", "Нове завдання")}
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
            form="ai-task-form"
            disabled={isLoading}
            className={`${btnPrimary} ${btnContent} w-full sm:w-auto sm:min-w-36`}
          >
            {isLoading ? <SpinnerIcon /> : <PlusIcon />}
            {isLoading ? t("ai.tasks.form.starting", "Запуск…") : t("ai.tasks.form.start", "Запустити")}
          </button>
        </div>
      }
    >
      <form id="ai-task-form" onSubmit={submit} noValidate className="space-y-5">
        <p className="text-theme-sm leading-5 text-gray-500 dark:text-gray-400">
          {t(
            "ai.tasks.form.description",
            "Завдання виконується на сервері й не залежить від відкритої вкладки: ви можете закрити сторінку й повернутися пізніше.",
          )}
        </p>

        {formError && <Alert>{formError}</Alert>}

        <Field label={t("ai.tasks.form.titleLabel", "Назва (необов'язково)")} error={errors.title}>
          <input
            className={`${inputClass} w-full`}
            value={v.title}
            maxLength={255}
            onChange={(e) => set("title", e.target.value)}
            placeholder={t("ai.tasks.form.titlePlaceholder", "Наприклад, Аналіз ризиків кібербезпеки")}
            autoComplete="off"
          />
        </Field>

        <Field label={t("ai.tasks.form.instruction", "Інструкція")} error={errors.instruction}>
          <textarea
            className={`${inputClass} min-h-27.5 w-full resize-y`}
            rows={5}
            value={v.instruction}
            onChange={(e) => set("instruction", e.target.value)}
            placeholder={t(
              "ai.tasks.form.instructionPlaceholder",
              "Проаналізуй усі документи та підготуй структурований звіт із ключовими знахідками…",
            )}
            maxLength={32000}
            aria-invalid={Boolean(errors.instruction)}
            autoFocus
          />
        </Field>

        <Field label={t("ai.tasks.form.type", "Тип завдання")}>
          <div className="space-y-1.5">
            <select
              className={`${inputClass} h-10 w-full`}
              value={v.type}
              onChange={(e) => set("type", e.target.value as TaskType)}
            >
              {TASK_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(`ai.tasks.type.${o.value}`, o.label)}
                </option>
              ))}
            </select>
            {typeHint && <p className="text-theme-xs text-gray-500 dark:text-gray-400">{typeHint}</p>}
          </div>
        </Field>

        <Field label={t("ai.tasks.form.sources", "Джерела даних")} error={errors.sources}>
          <CollectionPicker
            value={v.collections}
            onChange={(ids) => set("collections", ids)}
            label={t("ai.tasks.form.sources", "Джерела даних")}
            maxHeightClass="max-h-44"
          />
        </Field>

        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
            {t("ai.tasks.form.formats", "Формат результату")}
          </legend>
          <div className="flex flex-wrap gap-2">
            {TASK_FORMAT_OPTIONS.map((f) => {
              const checked = v.formats.includes(f.value);
              return (
                <label
                  key={f.value}
                  className="relative inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-theme-sm text-gray-700 transition-colors hover:bg-gray-50 has-checked:border-brand-500 has-checked:bg-brand-50/60 has-checked:text-brand-700 has-focus-visible:ring-2 has-focus-visible:ring-brand-500/40 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5 dark:has-checked:border-brand-400 dark:has-checked:bg-brand-500/10 dark:has-checked:text-brand-300"
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() =>
                      set(
                        "formats",
                        checked ? v.formats.filter((x) => x !== f.value) : [...v.formats, f.value],
                      )
                    }
                  />
                  {checked && <CheckIcon className="size-3.5" />}
                  {f.label}
                </label>
              );
            })}
          </div>
          {errors.formats && (
            <p role="alert" className="text-theme-xs text-error-600 dark:text-error-400">
              {errors.formats}
            </p>
          )}
        </fieldset>

        <details className="group rounded-xl border border-gray-200 dark:border-white/10">
          <summary className="cursor-pointer list-none px-4 py-3 text-theme-sm font-medium text-gray-700 select-none dark:text-gray-300">
            {t("ai.tasks.form.advanced", "Додаткові параметри")}
          </summary>
          <div className="grid gap-4 border-t border-gray-100 p-4 sm:grid-cols-3 dark:border-white/5">
            {(
              [
                ["batchSize", t("ai.tasks.form.batchSize", "Розмір пакета"), "8", 1, 100],
                ["maxDocuments", t("ai.tasks.form.maxDocuments", "Макс. документів"), "5000", 1, 100000],
                ["itemRetries", t("ai.tasks.form.itemRetries", "Повторів на документ"), "2", 0, 10],
              ] as const
            ).map(([key, label, ph, min, max]) => (
              <div key={key} className="space-y-1.5">
                <label htmlFor={`ai-task-${key}`} className="block text-theme-xs font-medium text-gray-600 dark:text-gray-400">
                  {label}
                </label>
                <input
                  id={`ai-task-${key}`}
                  type="number"
                  inputMode="numeric"
                  min={min}
                  max={max}
                  placeholder={ph}
                  className={`${inputClass} h-10 w-full`}
                  value={v[key]}
                  onChange={(e) => set(key, e.target.value)}
                />
              </div>
            ))}
            <div className="space-y-1.5 sm:col-span-3">
              <label htmlFor="ai-task-focus" className="block text-theme-xs font-medium text-gray-600 dark:text-gray-400">
                {t("ai.tasks.form.focus", "Фокус аналізу (через кому)")}
              </label>
              <input
                id="ai-task-focus"
                className={`${inputClass} h-10 w-full`}
                value={v.focus}
                onChange={(e) => set("focus", e.target.value)}
                placeholder="cybersecurity, compliance"
              />
            </div>
          </div>
        </details>
      </form>
    </Modal>
  );
}
