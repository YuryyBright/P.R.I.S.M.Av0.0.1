import { useState, type FormEvent } from "react";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { btnPrimary, inputClass } from "@/shared/ui/classes";
import { Field } from "@/shared/ui/Field";
import { useAuthActions } from "../hooks/useAuthActions";

/** Protected. On success every OTHER session is ended and this one gets a fresh token (handled in the endpoint). */
export default function ChangePasswordPage() {
  const { changePassword, isPending } = useAuthActions();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    if (next !== confirm) return setError("Passwords do not match");
    try {
      const res = await changePassword({ current_password: current, new_password: next });
      setDone(res.message);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(isNormalizedApiError(err) ? err.message : "Unexpected error");
    }
  }

  return (
    <div className="max-w-md space-y-5">
      <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">Change password</h1>
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        {done && <Alert variant="success">{done}</Alert>}
        <Field label="Current password">
          <input className={inputClass} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </Field>
        <Field label="New password">
          <input className={inputClass} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
        </Field>
        <Field label="Confirm new password">
          <input className={inputClass} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </Field>
        <button className={btnPrimary} disabled={isPending}>
          {isPending ? "Saving…" : "Change password"}
        </button>
      </form>
    </div>
  );
}
