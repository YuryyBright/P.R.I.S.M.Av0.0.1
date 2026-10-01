import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { AuthHeading } from "../components/AuthShell";
import { AuthStatusIcon, authPrimaryBtnClass } from "../components/AuthUi";
import { AUTH_ROUTES } from "../constants/auth.constants";
import { useAuthActions } from "../hooks/useAuthActions";

type State =
  | { kind: "loading" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

/**
 * Landing page of the emailed link: /verify-email?token=... (link format assumed, check the mail template).
 * Rendered inside <AuthShell/> (layout route), so no wrapper here.
 */
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const { verifyEmail } = useAuthActions();
  const [state, setState] = useState<State>(
    token
      ? { kind: "loading" }
      : { kind: "error", message: "The link is missing its token." },
  );
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return; // StrictMode runs effects twice; the token is single-use
    sent.current = true;
    verifyEmail(token)
      .then((r) => setState({ kind: "ok", message: r.message }))
      .catch((e) =>
        setState({
          kind: "error",
          message: isNormalizedApiError(e) ? e.message : "Unexpected error",
        }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const view =
    state.kind === "loading"
      ? {
          icon: "loading" as const,
          title: "Verifying your email",
          text: "This will only take a moment.",
        }
      : state.kind === "ok"
        ? {
            icon: "success" as const,
            title: "Email verified",
            text: state.message,
          }
        : {
            icon: "error" as const,
            title: "Verification failed",
            text: state.message,
          };

  return (
    <div className="text-center" aria-live="polite">
      <AuthStatusIcon kind={view.icon} />
      <AuthHeading align="center" title={view.title} subtitle={view.text} />

      {state.kind !== "loading" && (
        <Link to={AUTH_ROUTES.signIn} className={authPrimaryBtnClass}>
          Go to sign in
        </Link>
      )}
    </div>
  );
}
