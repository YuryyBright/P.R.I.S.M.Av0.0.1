import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { btnPrimary, btnSecondary, inputClass } from "@/shared/ui/classes";
import { Alert } from "@/shared/ui/Alert";
import { Field } from "@/shared/ui/Field";
import { Modal } from "@/shared/ui/Modal";

import { VISIBILITY_OPTIONS } from "../constants/collections.constants";
import { useCollectionActions } from "../hooks/useCollectionActions";
import {
  collectionToForm,
  emptyCollectionForm,
  formToCreatePayload,
  formToUpdatePayload,
  type CollectionFormValues,
} from "../lib/collectionMappers";
import type { Collection } from "../types/collection.types";
import { SpinnerIcon } from "./CollectionIcons";

interface Props {
  /** Present -> edit mode. Absent -> create mode. Mount with a `key` so state resets. */
  collection?: Collection;
  onClose: () => void;
  onSaved?: (message: string) => void;
}

function validate(
  values: CollectionFormValues,
  t: ReturnType<typeof useTranslation>["t"],
): Record<string, string> {
  const errors: Record<string, string> = {};

  const name = values.name.trim();

  if (!name) {
    errors.name = t(
      "collections.form.validation.nameRequired",
      "Назва обов'язкова",
    );
  } else if (name.length > 255) {
    errors.name = t(
      "collections.form.validation.nameMax",
      "Максимальна довжина — 255 символів",
    );
  }

  if (values.description.length > 5000) {
    errors.description = t(
      "collections.form.validation.descriptionMax",
      "Максимальна довжина — 5000 символів",
    );
  }

  return errors;
}

export function CollectionFormModal({ collection, onClose, onSaved }: Props) {
  const { t } = useTranslation();

  const isEdit = Boolean(collection);

  const { createCollection, updateCollection, isMutating } =
    useCollectionActions();

  const [values, setValues] = useState<CollectionFormValues>(() =>
    collection ? collectionToForm(collection) : emptyCollectionForm,
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof CollectionFormValues>(
    key: K,
    value: CollectionFormValues[K],
  ) => {
    setValues((previous) => ({
      ...previous,
      [key]: value,
    }));

    // Clear field error when user starts editing the field.
    setFieldErrors((previous) => {
      if (!previous[key as string]) {
        return previous;
      }

      const next = { ...previous };
      delete next[key as string];

      return next;
    });

    // Clear general form error when user edits the form.
    if (formError) {
      setFormError(null);
    }
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError(null);

    const localErrors = validate(values, t);

    setFieldErrors(localErrors);

    if (Object.keys(localErrors).length > 0) {
      return;
    }

    try {
      if (collection) {
        const payload = formToUpdatePayload(values, collection);

        // No changes — simply close the modal.
        if (Object.keys(payload).length === 0) {
          onClose();
          return;
        }

        await updateCollection(collection.id, payload);

        onSaved?.(t("collections.form.messages.updated", "Колекцію оновлено"));
      } else {
        await createCollection(formToCreatePayload(values));

        onSaved?.(t("collections.form.messages.created", "Колекцію створено"));
      }

      onClose();
    } catch (error) {
      if (isNormalizedApiError(error)) {
        setFieldErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError(t("errors.unexpected", "Сталася неочікувана помилка"));
      }
    }
  }

  const descriptionLength = values.description.length;

  /**
   * i18n structure:
   *
   * collections.visibility.{private|shared|public}.label
   * collections.visibility.{private|shared|public}.hint
   */

  return (
    <Modal
      open
      onClose={onClose}
      title={
        isEdit
          ? t("collections.form.editTitle", "Редагувати колекцію")
          : t("collections.form.createTitle", "Нова колекція")
      }
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            className={`${btnSecondary} w-full sm:w-auto`}
            onClick={onClose}
            disabled={isMutating}
          >
            {t("common.cancel", "Скасувати")}
          </button>

          <button
            type="submit"
            form="collection-form"
            disabled={isMutating}
            className={`${btnPrimary} w-full gap-2 sm:w-auto sm:min-w-27.5`}
          >
            {isMutating && <SpinnerIcon />}
            {isMutating
              ? t("common.saving", "Збереження…")
              : isEdit
                ? t("common.saveChanges", "Зберегти зміни")
                : t("common.create", "Створити")}
          </button>
        </div>
      }
    >
      <form
        id="collection-form"
        onSubmit={submit}
        className="space-y-5"
        noValidate
      >
        <p className="text-theme-sm leading-5 text-gray-500 dark:text-gray-400">
          {isEdit
            ? t(
                "collections.form.editDescription",
                "Змініть параметри колекції та збережіть зміни.",
              )
            : t(
                "collections.form.createDescription",
                "Створіть колекцію для організації та спільної роботи з матеріалами.",
              )}
        </p>

        {/* Form error */}
        {formError && <Alert>{formError}</Alert>}

        {/* Name */}
        <Field
          label={t("collections.form.name", "Назва")}
          error={fieldErrors.name}
        >
          <div className="space-y-1.5">
            <input
              className={`${inputClass} w-full`}
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder={t(
                "collections.form.namePlaceholder",
                "Наприклад, Новини України",
              )}
              maxLength={255}
              autoComplete="off"
              autoFocus
              required
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby="collection-name-hint"
            />

            <div className="flex items-center justify-between gap-3">
              <p
                id="collection-name-hint"
                className="text-theme-xs text-gray-500 dark:text-gray-400"
              >
                {t(
                  "collections.form.nameHint",
                  "Введіть зрозумілу назву колекції",
                )}
              </p>

              <span
                aria-hidden="true"
                className="text-theme-xs text-gray-400 tabular-nums dark:text-gray-500"
              >
                {values.name.length}/255
              </span>
            </div>
          </div>
        </Field>

        {/* Description */}
        <Field
          label={t("collections.form.description", "Опис")}
          error={fieldErrors.description}
        >
          <div className="space-y-1.5">
            <textarea
              className={`${inputClass} min-h-27.5 w-full resize-y`}
              rows={4}
              value={values.description}
              onChange={(event) => set("description", event.target.value)}
              placeholder={t(
                "collections.form.descriptionPlaceholder",
                "Коротко опишіть призначення цієї колекції...",
              )}
              maxLength={5000}
              aria-invalid={Boolean(fieldErrors.description)}
            />

            <div className="flex justify-end">
              <span
                aria-hidden="true"
                className={`text-theme-xs tabular-nums ${
                  descriptionLength > 4800
                    ? "text-warning-600 dark:text-warning-400"
                    : "text-gray-400 dark:text-gray-500"
                }`}
              >
                {descriptionLength}/5000
              </span>
            </div>
          </div>
        </Field>

        {/* Visibility: radio cards, so every option's hint is visible before choosing */}
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
            {t("collections.form.visibility", "Видимість")}
          </legend>

          <div className="grid gap-2">
            {VISIBILITY_OPTIONS.map((option) => {
              const checked = values.visibility === option.value;

              return (
                <label
                  key={option.value}
                  className="relative flex cursor-pointer flex-col gap-1 rounded-xl border border-gray-200 bg-white p-3.5 transition-colors hover:border-gray-300 has-checked:border-brand-500 has-checked:bg-brand-50/50 has-focus-visible:ring-2 has-focus-visible:ring-brand-500/40 dark:border-white/10 dark:bg-transparent dark:hover:border-white/20 dark:has-checked:border-brand-400 dark:has-checked:bg-brand-500/10"
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={option.value}
                    checked={checked}
                    onChange={() =>
                      set(
                        "visibility",
                        option.value as CollectionFormValues["visibility"],
                      )
                    }
                    className="sr-only"
                  />

                  <span className="flex items-center gap-2.5 text-theme-sm font-medium text-gray-800 dark:text-white/90">
                    <span
                      aria-hidden="true"
                      className={`flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        checked
                          ? "border-brand-500 dark:border-brand-400"
                          : "border-gray-300 dark:border-white/25"
                      }`}
                    >
                      {checked && (
                        <span className="size-2 rounded-full bg-brand-500 dark:bg-brand-400" />
                      )}
                    </span>
                    {t(
                      `collections.visibility.${option.value}.label`,
                      option.label,
                    )}
                  </span>

                  <span className="pl-6.5 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
                    {t(
                      `collections.visibility.${option.value}.hint`,
                      option.hint ?? "",
                    )}
                  </span>
                </label>
              );
            })}
          </div>

          {fieldErrors.visibility && (
            <p
              role="alert"
              className="text-theme-xs text-error-600 dark:text-error-400"
            >
              {fieldErrors.visibility}
            </p>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}
