import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronLeftIcon } from "@/icons";
import { Spinner } from "@/shared/ui/Spinner";

/* ------------------------------------------------------------------ */
/* Єдині класи для всіх auth-екранів                                   */
/* ------------------------------------------------------------------ */

export const authInputClass =
  "h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 transition-all outline-none placeholder:text-gray-400 focus:border-gray-400 focus:ring-4 focus:ring-gray-100 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-600 dark:focus:ring-gray-800/50";

export const authPrimaryBtnClass =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-5 text-sm font-medium text-white shadow-sm transition-all hover:bg-gray-800 hover:shadow-md focus-visible:ring-4 focus-visible:ring-gray-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200 dark:focus-visible:ring-gray-700";

export const authSecondaryBtnClass =
  "flex h-12 w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-medium text-gray-800 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 focus-visible:ring-4 focus-visible:ring-gray-100 focus-visible:outline-none dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-200 dark:hover:border-gray-700 dark:hover:bg-white/[0.06] dark:focus-visible:ring-gray-800/50";

export const authLinkClass =
  "text-sm font-medium text-gray-900 transition-colors hover:text-gray-500 dark:text-white dark:hover:text-gray-400";

/* ------------------------------------------------------------------ */
/* Компоненти                                                          */
/* ------------------------------------------------------------------ */

/** Головна кнопка форми: спінер + текст очікування. */
export function AuthSubmit({
  pending,
  pendingLabel,
  children,
  className = "",
}: {
  pending: boolean;
  pendingLabel: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${authPrimaryBtnClass} ${className}`}
    >
      {pending && <Spinner />}
      <span>{pending ? pendingLabel : children}</span>
    </button>
  );
}

type Kind = "mail" | "loading" | "success" | "error";

const TONES: Record<Kind, string> = {
  mail: "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400",
  loading:
    "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400",
  success:
    "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500",
  error: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
};

const PATHS: Record<Exclude<Kind, "loading">, ReactNode> = {
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  success: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  error: <path d="M6 6l12 12M18 6 6 18" />,
};

/** Round icon badge shown above the heading on "result" screens (check your email, verified, failed...). */
export function AuthStatusIcon({ kind }: { kind: Kind }) {
  return (
    <div
      className={`mx-auto mb-5 flex size-14 items-center justify-center rounded-full ${TONES[kind]}`}
    >
      {kind === "loading" ? (
        <Spinner className="size-7" />
      ) : (
        <svg
          className="size-7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {PATHS[kind]}
        </svg>
      )}
    </div>
  );
}

/** Quiet "← Back to ..." link, same look as the one in the TailAdmin sign-in template. */
export function BackLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
    >
      <ChevronLeftIcon className="size-5 rtl:rotate-180" />
      {children}
    </Link>
  );
}

/** Підпис під формою / екраном результату: "← Назад до входу". */
export function AuthFooter({ children }: { children: ReactNode }) {
  return <div className="mt-8">{children}</div>;
}
