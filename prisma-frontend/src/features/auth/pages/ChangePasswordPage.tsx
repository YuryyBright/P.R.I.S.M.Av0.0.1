import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { Field } from "@/shared/ui/Field";
import { PasswordInput } from "@/shared/ui/PasswordInput";
import { AuthSubmit } from "../components/AuthUi";
import { useAuthActions } from "../hooks/useAuthActions";

/** Protected, rendered inside the app layout. On success every OTHER session is ended and this one gets a fresh token (handled in the endpoint). */
export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const { changePassword, isPending } = useAuthActions();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    if (next !== confirm) {
      setError(t("auth.errors.passwordsMismatch"));
      return;
    }
    try {
      const res = await changePassword({
        current_password: current,
        new_password: next,
      });
      setDone(res.message);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(isNormalizedApiError(err) ? err.message : t("errors.unexpected"));
    }
  }

  return (
    <>
      <PageBreadcrumb pageTitle={t("auth.changePassword.pageTitle")} />

      <div className="max-w-xl rounded-2xl border border-gray-200 bg-white p-5 lg:p-7 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-6">
          <h2 className="text-lg font-semibold tracking-tight text-gray-950 dark:text-white">
            {t("auth.changePassword.cardTitle")}
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-gray-500 dark:text-gray-400">
            {t("auth.changePassword.cardHint")}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div aria-live="polite" className="space-y-3 empty:hidden">
            {error && <Alert>{error}</Alert>}
            {done && <Alert variant="success">{done}</Alert>}
          </div>

          <Field label={t("auth.fields.currentPassword")}>
            <PasswordInput
              autoComplete="current-password"
              placeholder={t("auth.placeholders.enterCurrentPassword")}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </Field>

          <Field label={t("auth.fields.newPassword")}>
            <PasswordInput
              autoComplete="new-password"
              placeholder={t("auth.placeholders.createNewPassword")}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
          </Field>

          <Field label={t("auth.fields.confirmNewPassword")}>
            <PasswordInput
              autoComplete="new-password"
              placeholder={t("auth.placeholders.repeatNewPassword")}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </Field>

          <AuthSubmit
            pending={isPending}
            pendingLabel={t("auth.changePassword.pending")}
            className="sm:w-auto sm:min-w-48"
          >
            {t("auth.changePassword.submit")}
          </AuthSubmit>
        </form>
      </div>
    </>
  );
}
