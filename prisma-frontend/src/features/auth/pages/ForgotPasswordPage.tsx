import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { Field } from "@/shared/ui/Field";
import { AuthHeading } from "../components/AuthShell";
import {
  AuthFooter,
  AuthStatusIcon,
  AuthSubmit,
  BackLink,
  authInputClass,
  authPrimaryBtnClass,
} from "../components/AuthUi";
import { AUTH_ROUTES } from "../constants/auth.constants";
import { useAuthActions } from "../hooks/useAuthActions";

/** Rendered inside <AuthShell/> (layout route), so no wrapper here. */
export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { requestPasswordReset, isPending } = useAuthActions();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setDone((await requestPasswordReset({ email: email.trim() })).message); // uniform for every address
    } catch (err) {
      setError(isNormalizedApiError(err) ? err.message : t("errors.unexpected")); // e.g. 429 after 3/hour
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <AuthStatusIcon kind="mail" />
        <AuthHeading
          align="center"
          title={t("auth.checkEmail")}
          subtitle={done}
        />
        <Link to={AUTH_ROUTES.signIn} className={authPrimaryBtnClass}>
          {t("auth.backToSignIn")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <AuthHeading
        title={t("auth.forgot.title")}
        subtitle={t("auth.forgot.subtitle")}
      />

      <form onSubmit={submit} className="space-y-5">
        <div aria-live="polite" className="empty:hidden">
          {error && <Alert>{error}</Alert>}
        </div>

        <Field label={t("auth.fields.email")}>
          <input
            className={authInputClass}
            type="email"
            autoComplete="username"
            placeholder={t("auth.placeholders.email")}
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>

        <AuthSubmit pending={isPending} pendingLabel={t("auth.forgot.pending")}>
          {t("auth.forgot.submit")}
        </AuthSubmit>
      </form>

      <AuthFooter>
        <BackLink to={AUTH_ROUTES.signIn}>{t("auth.backToSignIn")}</BackLink>
      </AuthFooter>
    </>
  );
}
