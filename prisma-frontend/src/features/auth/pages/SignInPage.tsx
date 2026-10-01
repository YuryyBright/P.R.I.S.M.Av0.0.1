import { useEffect, useState, type FormEvent } from "react";
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
        setError("Unexpected error");
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
      setError(isNormalizedApiError(err) ? err.message : "Unexpected error");
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <AuthHeading
        title="Welcome back."
        subtitle="Sign in to continue to your P.R.I.S.M.A. workspace."
      />

      <form onSubmit={submit} className="space-y-5">
        <div aria-live="polite" className="space-y-3 empty:hidden">
          {error && <Alert>{error}</Alert>}
          {info && <Alert variant="success">{info}</Alert>}

          {(notVerified || info) && (
            <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:bg-white/[0.03]">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Didn&apos;t get the email?
              </span>

              <button
                type="button"
                onClick={() => void resend()}
                disabled={resending || cooldown > 0 || !email.trim()}
                className="inline-flex items-center gap-2 text-sm font-medium text-gray-900 transition-colors hover:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white dark:hover:text-gray-400"
              >
                {resending && <Spinner className="size-3.5" />}
                {cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Resend verification email"}
              </button>
            </div>
          )}
        </div>

        <Field label="Email">
          <input
            className={authInputClass}
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
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
              Password
            </label>

            <Link
              to={AUTH_ROUTES.forgotPassword}
              className="text-xs font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Forgot password?
            </Link>
          </div>

          <PasswordInput
            id="signin-password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <AuthSubmit pending={isPending} pendingLabel="Signing in…">
          Sign in
        </AuthSubmit>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-800" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-4 text-xs text-gray-400 dark:bg-gray-950 dark:text-gray-500">
              New to P.R.I.S.M.A.?
            </span>
          </div>
        </div>

        <Link to={AUTH_ROUTES.signUp} className={authSecondaryBtnClass}>
          Create an account
        </Link>

        <p className="pt-1 text-center text-xs leading-5 text-gray-400 dark:text-gray-500">
          By continuing, you agree to the P.R.I.S.M.A.{" "}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300"
          >
            Terms of Service
          </button>{" "}
          and{" "}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300"
          >
            Privacy Policy
          </button>
          .
        </p>
      </form>
    </>
  );
}
