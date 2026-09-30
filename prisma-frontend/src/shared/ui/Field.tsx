import type { ReactNode } from "react";

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">{label}</span>
      {children}
      {error && <span className="mt-1 block text-theme-xs text-error-500">{error}</span>}
    </label>
  );
}
