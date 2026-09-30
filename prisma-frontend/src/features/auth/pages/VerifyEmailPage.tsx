import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { linkClass } from "@/shared/ui/classes";
import { AuthLayout } from "../components/AuthLayout";
import { AUTH_ROUTES } from "../constants/auth.constants";
import { useAuthActions } from "../hooks/useAuthActions";

type State = { kind: "loading" } | { kind: "ok"; message: string } | { kind: "error"; message: string };

/** Landing page of the emailed link: /verify-email?token=... (link format assumed, check the mail template). */
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const { verifyEmail } = useAuthActions();
  const [state, setState] = useState<State>(token ? { kind: "loading" } : { kind: "error", message: "The link is missing its token." });
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return; // StrictMode runs effects twice; the token is single-use
    sent.current = true;
    verifyEmail(token)
      .then((r) => setState({ kind: "ok", message: r.message }))
      .catch((e) => setState({ kind: "error", message: isNormalizedApiError(e) ? e.message : "Unexpected error" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthLayout title="Email verification">
      {state.kind === "loading" && <Alert variant="info">Verifying…</Alert>}
      {state.kind === "ok" && <Alert variant="success">{state.message}</Alert>}
      {state.kind === "error" && <Alert>{state.message}</Alert>}
      {state.kind !== "loading" && (
        <Link className={`${linkClass} mt-4 inline-block text-sm`} to={AUTH_ROUTES.signIn}>Go to sign in</Link>
      )}
    </AuthLayout>
  );
}
