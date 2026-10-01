import { useState, type FormEvent } from "react";
import { Link } from "react-router";
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
  authInputClass,
  authPrimaryBtnClass,
} from "../components/AuthUi";
import { AUTH_ROUTES } from "../constants/auth.constants";
import { useAuthActions } from "../hooks/useAuthActions";

/** Rendered inside <AuthShell/> (layout route), so no wrapper here. */
export default function SignUpPage() {
  const { register, isPending } = useAuthActions();
  const [v, setV] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);
  const set = (k: keyof typeof v, value: string) =>
    setV((p) => ({ ...p, [k]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (v.password !== v.confirm) {
      setFieldErrors({ confirm: "Passwords do not match" });
      return;
    }
    setFieldErrors({});
    try {
      const res = await register({
        email: v.email.trim(),
        password: v.password,
        first_name: v.first_name.trim() || undefined,
        last_name: v.last_name.trim() || undefined,
      });
      setDone(res.message); // identical for every address on purpose
    } catch (err) {
      if (!isNormalizedApiError(err)) {
        setError("Unexpected error");
        return;
      }
      setFieldErrors(err.fieldErrors);
      setError(err.message); // password-policy refusals land here with the server's wording
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <AuthStatusIcon kind="mail" />
        <AuthHeading align="center" title="Check your email" subtitle={done} />
        <Link to={AUTH_ROUTES.signIn} className={authPrimaryBtnClass}>
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <AuthHeading
        title="Create account"
        subtitle="Fill in the details to get started."
      />

      <form onSubmit={submit} className="space-y-5">
        <div aria-live="polite" className="empty:hidden">
          {error && <Alert>{error}</Alert>}
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="First name" error={fieldErrors.first_name}>
            <input
              className={authInputClass}
              autoComplete="given-name"
              autoFocus
              value={v.first_name}
              onChange={(e) => set("first_name", e.target.value)}
            />
          </Field>
          <Field label="Last name" error={fieldErrors.last_name}>
            <input
              className={authInputClass}
              autoComplete="family-name"
              value={v.last_name}
              onChange={(e) => set("last_name", e.target.value)}
            />
          </Field>
        </div>

        <Field label="Email" error={fieldErrors.email}>
          <input
            className={authInputClass}
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            value={v.email}
            onChange={(e) => set("email", e.target.value)}
            required
          />
        </Field>

        <Field label="Password" error={fieldErrors.password}>
          <PasswordInput
            autoComplete="new-password"
            placeholder="Create a password"
            value={v.password}
            onChange={(e) => set("password", e.target.value)}
            required
          />
        </Field>

        <Field label="Confirm password" error={fieldErrors.confirm}>
          <PasswordInput
            autoComplete="new-password"
            placeholder="Repeat the password"
            value={v.confirm}
            onChange={(e) => set("confirm", e.target.value)}
            required
          />
        </Field>

        <AuthSubmit pending={isPending} pendingLabel="Creating account…">
          Create account
        </AuthSubmit>
      </form>

      <AuthFooter>
        <BackLink to={AUTH_ROUTES.signIn}>
          Already have an account? Sign in
        </BackLink>
      </AuthFooter>
    </>
  );
}
