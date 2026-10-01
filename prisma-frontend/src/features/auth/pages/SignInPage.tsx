import { useEffect, useState, type FormEvent } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { Field } from "@/shared/ui/Field";
import { PasswordInput } from "@/shared/ui/PasswordInput";
import { Spinner } from "@/shared/ui/Spinner";
import { AuthHeading } from "../components/AuthShell";
import {
  AuthSubmit,
  authInputClass,
  authSecondaryBtnClass,
} from "../components/AuthUi";
import { AUTH_ROUTES } from "../constants/auth.constants";
import { useAuthActions } from "../hooks/useAuthActions";

const RESEND_COOLDOWN_SECONDS = 30;

/** Rendered inside <AuthShell/> (layout route): бренд уже є в оболонці, тут його не дублюємо. */
export default function SignInPage() {
  const { t } = useTranslation();
  const { login, resendVerification, isPending } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notVerified, setNotVerified] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setNotVerified(false);

    try {
      await login({ email: email.trim(), password });
    } catch (err) {
      if (!isNormalizedApiError(err)) {
        setError(t("errors.unexpected"));
        return;
      }
      setError(err.message);
      setNotVerified(/not verified/i.test(err.message));
    }
  }

  async function resend() {
    setResending(true);
    setInfo(null);

    try {
      const res = await resendVerification({ email: email.trim() });
      setError(null);
      setInfo(res.message);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(isNormalizedApiError(err) ? err.message : t("errors.unexpected"));
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <AuthHeading
        title={t("auth.signIn.title")}
        subtitle={t("auth.signIn.subtitle")}
      />

      <form onSubmit={submit} className="space-y-5">
        <div aria-live="polite" className="space-y-3 empty:hidden">
          {error && <Alert>{error}</Alert>}
          {info && <Alert variant="success">{info}</Alert>}

          {(notVerified || info) && (
            <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:bg-white/[0.03]">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t("auth.signIn.didntGetEmail")}
              </span>

              <button
                type="button"
                onClick={() => void resend()}
                disabled={resending || cooldown > 0 || !email.trim()}
                className="inline-flex items-center gap-2 text-sm font-medium text-gray-900 transition-colors hover:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white dark:hover:text-gray-400"
              >
                {resending && <Spinner className="size-3.5" />}
                {cooldown > 0
                  ? t("auth.signIn.resendIn", { seconds: cooldown })
                  : t("auth.signIn.resend")}
              </button>
            </div>
          )}
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

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label
              htmlFor="signin-password"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t("auth.fields.password")}
            </label>

            <Link
              to={AUTH_ROUTES.forgotPassword}
              className="text-xs font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              {t("auth.signIn.forgot")}
            </Link>
          </div>

          <PasswordInput
            id="signin-password"
            autoComplete="current-password"
            placeholder={t("auth.placeholders.enterPassword")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <AuthSubmit pending={isPending} pendingLabel={t("auth.signIn.pending")}>
          {t("auth.signIn.submit")}
        </AuthSubmit>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-800" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-4 text-xs text-gray-400 dark:bg-gray-950 dark:text-gray-500">
              {t("auth.signIn.newTo")}
            </span>
          </div>
        </div>

        <Link to={AUTH_ROUTES.signUp} className={authSecondaryBtnClass}>
          {t("auth.signIn.createAccount")}
        </Link>

        <p className="pt-1 text-center text-xs leading-5 text-gray-400 dark:text-gray-500">
          <Trans
            i18nKey="auth.signIn.agreement"
            components={{
              terms: (
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300"
                />
              ),
              privacy: (
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300"
                />
              ),
            }}
          />
        </p>
      </form>
    </>
  );
}
