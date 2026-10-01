import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { Field } from "@/shared/ui/Field";
import { PasswordInput } from "@/shared/ui/PasswordInput";
import { AuthHeading } from "../components/AuthShell";
import {
  AuthFooter,
  AuthStatusIcon,
  AuthSubmit,
  BackLink,
  authPrimaryBtnClass,
} from "../components/AuthUi";
import { AUTH_ROUTES } from "../constants/auth.constants";
import { useAuthActions } from "../hooks/useAuthActions";

/** /reset-password?token=...  Rendered inside <AuthShell/> (layout route), so no wrapper here. */
export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token");
  const { confirmPasswordReset, isPending } = useAuthActions();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError(t("auth.errors.missingToken"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.errors.passwordsMismatch"));
      return;
    }
    try {
      setDone(
        (await confirmPasswordReset({ token, new_password: password })).message,
      );
    } catch (err) {
      // Either the uniform "invalid token" message, or a password-policy / reuse refusal.
      setError(isNormalizedApiError(err) ? err.message : t("errors.unexpected"));
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <AuthStatusIcon kind="success" />
        <AuthHeading
          align="center"
          title={t("auth.reset.doneTitle")}
          subtitle={done}
        />
        <Link to={AUTH_ROUTES.signIn} className={authPrimaryBtnClass}>
          {t("auth.goToSignIn")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <AuthHeading
        title={t("auth.reset.title")}
        subtitle={t("auth.reset.subtitle")}
      />

      <form onSubmit={submit} className="space-y-5">
        <div aria-live="polite" className="empty:hidden">
          {error && <Alert>{error}</Alert>}
        </div>

        <Field label={t("auth.fields.newPassword")}>
          <PasswordInput
            autoComplete="new-password"
            placeholder={t("auth.placeholders.createPassword")}
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        <Field label={t("auth.fields.confirmNewPassword")}>
          <PasswordInput
            autoComplete="new-password"
            placeholder={t("auth.placeholders.repeatPassword")}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </Field>

        <AuthSubmit pending={isPending} pendingLabel={t("auth.reset.pending")}>
          {t("auth.reset.submit")}
        </AuthSubmit>
      </form>

      <AuthFooter>
        <BackLink to={AUTH_ROUTES.signIn}>{t("auth.backToSignIn")}</BackLink>
      </AuthFooter>
    </>
  );
}
