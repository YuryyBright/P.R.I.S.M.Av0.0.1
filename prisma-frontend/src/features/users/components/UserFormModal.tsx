import type { TFunction } from "i18next";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { btnPrimary, btnSecondary, inputClass } from "@/shared/ui/classes";
import { Alert } from "@/shared/ui/Alert";
import { Field } from "@/shared/ui/Field";
import { Modal } from "@/shared/ui/Modal";
import { useUserActions } from "../hooks/useUserActions";
import {
  emptyUserForm,
  formToCreatePayload,
  formToUpdatePayload,
  userToForm,
  type UserFormValues,
} from "../lib/userMappers";
import type { User } from "../types/user.types";

interface Props {
  /** Present -> edit mode. Absent -> create mode. Mount with a `key` so state resets. */
  user?: User;
  onClose: () => void;
  onSaved?: (message: string) => void;
}

function validate(v: UserFormValues, isEdit: boolean, t: TFunction): Record<string, string> {
  const e: Record<string, string> = {};
  if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = t("users.form.validation.email");
  // Password rules (length, complexity, reuse) live on the server -> show its message.
  if (!isEdit && !v.password) e.password = t("users.form.validation.passwordRequired");
  return e;
}

export function UserFormModal({ user, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const isEdit = Boolean(user);
  const { createUser, updateUser, isMutating } = useUserActions();
  const [values, setValues] = useState<UserFormValues>(() => (user ? userToForm(user) : emptyUserForm));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) =>
    setValues((p) => ({ ...p, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const local = validate(values, isEdit, t);
    setFieldErrors(local);
    if (Object.keys(local).length) return;

    try {
      if (user) {
        const payload = formToUpdatePayload(values, user);
        if (Object.keys(payload).length === 0) return onClose();
        const res = await updateUser(user.id, payload);
        onSaved?.(res.message);
      } else {
        const res = await createUser(formToCreatePayload(values));
        onSaved?.(res.message);
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

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? t("users.form.titleEdit") : t("users.form.titleAdd")}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            form="user-form"
            disabled={isMutating}
            className={btnPrimary}
          >
            {isMutating ? t("common.saving") : t("common.save")}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4">
        {formError && <Alert>{formError}</Alert>}
        <Field label={t("users.form.email")} error={fieldErrors.email}>
          <input className={inputClass} type="email" value={values.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("users.form.firstName")} error={fieldErrors.first_name}>
            <input className={inputClass} value={values.first_name} onChange={(e) => set("first_name", e.target.value)} />
          </Field>
          <Field label={t("users.form.lastName")} error={fieldErrors.last_name}>
            <input className={inputClass} value={values.last_name} onChange={(e) => set("last_name", e.target.value)} />
          </Field>
        </div>
        <Field label={t("users.form.phone")} error={fieldErrors.contact_phone}>
          <input className={inputClass} value={values.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
        </Field>
        <Field label={isEdit ? t("users.form.passwordKeep") : t("users.form.password")} error={fieldErrors.password}>
          <input
            className={inputClass}
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => set("password", e.target.value)}
          />
        </Field>
        <Field label={t("users.form.expires")} error={fieldErrors.expiry_date}>
          <input
            className={inputClass}
            type="datetime-local"
            value={values.expiry_date}
            onChange={(e) => set("expiry_date", e.target.value)}
          />
        </Field>
        <div className="flex gap-6 text-sm text-gray-700 dark:text-gray-400">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={values.is_active} onChange={(e) => set("is_active", e.target.checked)} />
            {t("users.form.active")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={values.is_superuser} onChange={(e) => set("is_superuser", e.target.checked)} />
            {t("users.form.superuser")}
          </label>
        </div>
      </form>
    </Modal>
  );
}
