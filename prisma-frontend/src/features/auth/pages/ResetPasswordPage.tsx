import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { btnPrimary, inputClass, linkClass } from "@/shared/ui/classes";
import { Field } from "@/shared/ui/Field";
import { AuthLayout } from "../components/AuthLayout";
import { AUTH_ROUTES } from "../constants/auth.constants";
import { useAuthActions } from "../hooks/useAuthActions";

/** /reset-password?token=... */
export default function ResetPasswordPage() {
  const token = useSearchParams()[0].get("token");
  const { confirmPasswordReset, isPending } = useAuthActions();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) return setError("The link is missing its token.");
    if (password !== confirm) return setError("Passwords do not match");
    try {
      setDone((await confirmPasswordReset({ token, new_password: password })).message);
    } catch (err) {
      // Either the uniform "invalid token" message, or a password-policy / reuse refusal.
      setError(isNormalizedApiError(err) ? err.message : "Unexpected error");
    }
  }

  return (
    <AuthLayout title="Set a new password">
      {done ? (
        <Alert variant="success">{done}</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <Field label="New password">
            <input className={inputClass} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Field label="Confirm new password">
            <input className={inputClass} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
          <button className={`${btnPrimary} w-full`} disabled={isPending}>
            {isPending ? "Saving…" : "Reset password"}
          </button>
        </form>
      )}
      <Link className={`${linkClass} mt-4 inline-block text-sm`} to={AUTH_ROUTES.signIn}>Go to sign in</Link>
    </AuthLayout>
  );
}
