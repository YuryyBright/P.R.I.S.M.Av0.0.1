import type { ReactNode } from "react";

type Variant = "error" | "success" | "info";

const STYLES: Record<Variant, string> = {
  error: "bg-error-50 text-error-600 dark:bg-error-500/15",
  success: "bg-success-50 text-success-600 dark:bg-success-500/15",
  info: "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300",
};

export function Alert({ variant = "error", children }: { variant?: Variant; children: ReactNode }) {
  return (
    <div role={variant === "error" ? "alert" : "status"} className={`rounded-lg px-4 py-3 text-sm ${STYLES[variant]}`}>
      {children}
    </div>
  );
}
