import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { btnPrimary, inputClass, linkClass } from "@/shared/ui/classes";
import { Field } from "@/shared/ui/Field";
import { AuthLayout } from "../components/AuthLayout";
import { AUTH_ROUTES } from "../constants/auth.constants";
import { useAuthActions } from "../hooks/useAuthActions";

export default function SignInPage() {
  const { login, resendVerification, isPending } = useAuthActions();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notVerified, setNotVerified] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setNotVerified(false);
    try {
      await login({ email: email.trim(), password });
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
      navigate(from ?? "/", { replace: true });
    } catch (err) {
      if (!isNormalizedApiError(err)) return setError("Unexpected error");
      setError(err.message); // the backend attaches every login failure to field "email"; one banner is enough
      // Fragile: matches the text "Email is not verified." (no error code from the backend).
      setNotVerified(/not verified/i.test(err.message));
    }
  }

  async function resend() {
    try {
      const res = await resendVerification({ email: email.trim() });
      setInfo(res.message);
    } catch (err) {
      setError(isNormalizedApiError(err) ? err.message : "Unexpected error");
    }
  }

  return (
    <AuthLayout title="Sign in" subtitle="Enter your email and password">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        {info && <Alert variant="success">{info}</Alert>}
        {notVerified && (
          <button type="button" className={linkClass} onClick={() => void resend()}>
            Resend verification email
          </button>
        )}
        <Field label="Email">
          <input className={inputClass} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password">
          <input className={inputClass} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <button className={`${btnPrimary} w-full`} disabled={isPending}>
          {isPending ? "Signing in…" : "Sign in"}
        </button>
        <div className="flex justify-between text-sm">
          <Link className={linkClass} to={AUTH_ROUTES.forgotPassword}>Forgot password?</Link>
          <Link className={linkClass} to={AUTH_ROUTES.signUp}>Create account</Link>
        </div>
      </form>
    </AuthLayout>
  );
}
