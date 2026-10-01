import type { TFunction } from "i18next";
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

function validate(v: CollectionFormValues, t: TFunction): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.name.trim()) e.name = t("collections.form.validation.nameRequired");
  else if (v.name.trim().length > 255) e.name = t("collections.form.validation.nameMax");
  if (v.description.length > 5000) e.description = t("collections.form.validation.descriptionMax");
  return e;
}

export function CollectionFormModal({ collection, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const isEdit = Boolean(collection);
  const { createCollection, updateCollection, isMutating } = useCollectionActions();
  const [values, setValues] = useState<CollectionFormValues>(() =>
    collection ? collectionToForm(collection) : emptyCollectionForm,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof CollectionFormValues>(key: K, value: CollectionFormValues[K]) =>
    setValues((p) => ({ ...p, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const local = validate(values, t);
    setFieldErrors(local);
    if (Object.keys(local).length) return;

    try {
      if (collection) {
        const payload = formToUpdatePayload(values, collection);
        if (Object.keys(payload).length === 0) return onClose();
        await updateCollection(collection.id, payload);
        onSaved?.(t("collections.form.updated"));
      } else {
        await createCollection(formToCreatePayload(values));
        onSaved?.(t("collections.form.created"));
      }
      onClose();
    } catch (err) {
      if (isNormalizedApiError(err)) {
        setFieldErrors(err.fieldErrors);
        setFormError(err.message);
      } else {
        setFormError(t("errors.unexpected"));
      }
    }
  }

  const hintKey = VISIBILITY_OPTIONS.find((o) => o.value === values.visibility)?.hintKey;

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? t("collections.form.titleEdit") : t("collections.form.titleNew")}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" form="collection-form" disabled={isMutating} className={btnPrimary}>
            {isMutating ? t("common.saving") : t("common.save")}
          </button>
        </>
      }
    >
      <form id="collection-form" onSubmit={submit} className="space-y-4">
        {formError && <Alert>{formError}</Alert>}
        <Field label={t("collections.form.name")} error={fieldErrors.name}>
          <input className={inputClass} value={values.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label={t("collections.form.description")} error={fieldErrors.description}>
          <textarea
            className={inputClass}
            rows={4}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
        <Field label={t("collections.form.visibility")} error={fieldErrors.visibility}>
          <select
            className={inputClass}
            value={values.visibility}
            onChange={(e) => set("visibility", e.target.value as CollectionFormValues["visibility"])}
          >
            {VISIBILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.labelKey)}
              </option>
            ))}
          </select>
          {hintKey && <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">{t(hintKey)}</p>}
        </Field>
      </form>
    </Modal>
  );
}
