import { useState, type FormEvent } from "react";
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
      setError(isNormalizedApiError(err) ? err.message : "Unexpected error"); // e.g. 429 after 3/hour
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <AuthStatusIcon kind="mail" />
        <AuthHeading align="center" title="Check your email" subtitle={done} />
        <Link to={AUTH_ROUTES.signIn} className={authPrimaryBtnClass}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <AuthHeading
        title="Forgot password?"
        subtitle="Enter your email and we will send you a reset link."
      />

      <form onSubmit={submit} className="space-y-5">
        <div aria-live="polite" className="empty:hidden">
          {error && <Alert>{error}</Alert>}
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

        <AuthSubmit pending={isPending} pendingLabel="Sending…">
          Send reset link
        </AuthSubmit>
      </form>

      <AuthFooter>
        <BackLink to={AUTH_ROUTES.signIn}>Back to sign in</BackLink>
      </AuthFooter>
    </>
  );
}
