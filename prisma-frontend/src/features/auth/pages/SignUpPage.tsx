import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { btnPrimary, inputClass, linkClass } from "@/shared/ui/classes";
import { Field } from "@/shared/ui/Field";
import { AuthLayout } from "../components/AuthLayout";
import { AUTH_ROUTES } from "../constants/auth.constants";
import { useAuthActions } from "../hooks/useAuthActions";

export default function SignUpPage() {
  const { register, isPending } = useAuthActions();
  const [v, setV] = useState({ first_name: "", last_name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);
  const set = (k: keyof typeof v, value: string) => setV((p) => ({ ...p, [k]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (v.password !== v.confirm) return setFieldErrors({ confirm: "Passwords do not match" });
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
      if (!isNormalizedApiError(err)) return setError("Unexpected error");
      setFieldErrors(err.fieldErrors);
      setError(err.message); // password-policy refusals land here with the server's wording
    }
  }

  if (done) {
    return (
      <AuthLayout title="Check your email">
        <Alert variant="success">{done}</Alert>
        <Link className={`${linkClass} mt-4 inline-block text-sm`} to={AUTH_ROUTES.signIn}>Back to sign in</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create account">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name" error={fieldErrors.first_name}>
            <input className={inputClass} value={v.first_name} onChange={(e) => set("first_name", e.target.value)} />
          </Field>
          <Field label="Last name" error={fieldErrors.last_name}>
            <input className={inputClass} value={v.last_name} onChange={(e) => set("last_name", e.target.value)} />
          </Field>
        </div>
        <Field label="Email" error={fieldErrors.email}>
          <input className={inputClass} type="email" value={v.email} onChange={(e) => set("email", e.target.value)} required />
        </Field>
        <Field label="Password" error={fieldErrors.password}>
          <input className={inputClass} type="password" autoComplete="new-password" value={v.password} onChange={(e) => set("password", e.target.value)} required />
        </Field>
        <Field label="Confirm password" error={fieldErrors.confirm}>
          <input className={inputClass} type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => set("confirm", e.target.value)} required />
        </Field>
        <button className={`${btnPrimary} w-full`} disabled={isPending}>
          {isPending ? "Creating…" : "Create account"}
        </button>
        <Link className={`${linkClass} text-sm`} to={AUTH_ROUTES.signIn}>Already have an account?</Link>
      </form>
    </AuthLayout>
  );
}
