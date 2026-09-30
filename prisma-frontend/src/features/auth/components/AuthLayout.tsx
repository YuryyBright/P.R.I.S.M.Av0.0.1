import type { ReactNode } from "react";

/** Centered card used by every public auth page. Swap for TailAdmin's AuthPageLayout if you like. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-theme-xs dark:border-white/[0.05] dark:bg-white/[0.03]">
        <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">{title}</h1>
        {subtitle && <p className="mt-1 mb-6 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
        {!subtitle && <div className="mb-6" />}
        {children}
      </div>
    </div>
  );
}
