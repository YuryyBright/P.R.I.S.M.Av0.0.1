import { useState, type FormEvent } from "react";
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
      setError("The link is missing its token.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    try {
      setDone(
        (await confirmPasswordReset({ token, new_password: password })).message,
      );
    } catch (err) {
      // Either the uniform "invalid token" message, or a password-policy / reuse refusal.
      setError(isNormalizedApiError(err) ? err.message : "Unexpected error");
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <AuthStatusIcon kind="success" />
        <AuthHeading align="center" title="Password updated" subtitle={done} />
        <Link to={AUTH_ROUTES.signIn} className={authPrimaryBtnClass}>
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <AuthHeading
        title="Set a new password"
        subtitle="Choose a strong password you have not used before."
      />

      <form onSubmit={submit} className="space-y-5">
        <div aria-live="polite" className="empty:hidden">
          {error && <Alert>{error}</Alert>}
        </div>

        <Field label="New password">
          <PasswordInput
            autoComplete="new-password"
            placeholder="Create a password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        <Field label="Confirm new password">
          <PasswordInput
            autoComplete="new-password"
            placeholder="Repeat the password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </Field>

        <AuthSubmit pending={isPending} pendingLabel="Saving…">
          Reset password
        </AuthSubmit>
      </form>

      <AuthFooter>
        <BackLink to={AUTH_ROUTES.signIn}>Back to sign in</BackLink>
      </AuthFooter>
    </>
  );
}
