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

  const visibilityOption = VISIBILITY_OPTIONS.find(
    (option) => option.value === values.visibility,
  );

  const descriptionLength = values.description.length;

  /**
   * i18n structure:
   *
   * collections.visibility.private.label
   * collections.visibility.private.hint
   *
   * collections.visibility.shared.label
   * collections.visibility.shared.hint
   *
   * collections.visibility.public.label
   * collections.visibility.public.hint
   */
  const visibilityLabel = visibilityOption
    ? t(
        `collections.visibility.${visibilityOption.value}.label`,
        visibilityOption.label,
      )
    : "";

  const visibilityHint = visibilityOption
    ? t(
        `collections.visibility.${visibilityOption.value}.hint`,
        visibilityOption.hint ?? "",
      )
    : "";

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
        <div className="flex w-full items-center justify-end gap-2">
          <button
            type="button"
            className={btnSecondary}
            onClick={onClose}
            disabled={isMutating}
          >
            {t("common.cancel", "Скасувати")}
          </button>

          <button
            type="submit"
            form="collection-form"
            disabled={isMutating}
            className={`${btnPrimary} min-w-[110px]`}
          >
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
        {/* Header description */}
        <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3 dark:border-white/5 dark:bg-white/[0.02]">
          <p className="text-theme-sm leading-5 text-gray-600 dark:text-gray-400">
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
        </div>

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
            />

            <div className="flex items-center justify-between">
              <p className="text-theme-xs text-gray-400">
                {t(
                  "collections.form.nameHint",
                  "Введіть зрозумілу назву колекції",
                )}
              </p>

              <span className="text-theme-xs text-gray-400">
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
              className={`${inputClass} min-h-[110px] w-full resize-y`}
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
                className={`text-theme-xs ${
                  descriptionLength > 4800
                    ? "text-warning-500"
                    : "text-gray-400"
                }`}
              >
                {descriptionLength}/5000
              </span>
            </div>
          </div>
        </Field>

        {/* Visibility */}
        <Field
          label={t("collections.form.visibility", "Видимість")}
          error={fieldErrors.visibility}
        >
          <div className="space-y-2">
            <select
              className={`${inputClass} w-full`}
              value={values.visibility}
              onChange={(event) =>
                set(
                  "visibility",
                  event.target.value as CollectionFormValues["visibility"],
                )
              }
              aria-invalid={Boolean(fieldErrors.visibility)}
            >
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(
                    `collections.visibility.${option.value}.label`,
                    option.label,
                  )}
                </option>
              ))}
            </select>

            {visibilityHint && (
              <div className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-white/[0.03]">
                <span className="mt-0.5 text-gray-400" aria-hidden="true">
                  ⓘ
                </span>

                <p className="text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
                  {visibilityHint}
                </p>
              </div>
            )}
          </div>
        </Field>
      </form>
    </Modal>
  );
}
