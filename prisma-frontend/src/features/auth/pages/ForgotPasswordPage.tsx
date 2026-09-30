import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { btnPrimary, inputClass, linkClass } from "@/shared/ui/classes";
import { Field } from "@/shared/ui/Field";
import { AuthLayout } from "../components/AuthLayout";
import { AUTH_ROUTES } from "../constants/auth.constants";
import { useAuthActions } from "../hooks/useAuthActions";

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

  return (
    <AuthLayout title="Forgot password" subtitle="We will email you a reset link">
      {done ? (
        <Alert variant="success">{done}</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <Field label="Email">
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <button className={`${btnPrimary} w-full`} disabled={isPending}>
            {isPending ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <Link className={`${linkClass} mt-4 inline-block text-sm`} to={AUTH_ROUTES.signIn}>Back to sign in</Link>
    </AuthLayout>
  );
}
