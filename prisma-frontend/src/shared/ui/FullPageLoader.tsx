import { useTranslation } from "react-i18next";

interface FullPageLoaderProps {
  label?: string;
}

export function FullPageLoader({ label }: FullPageLoaderProps) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-white px-6 dark:bg-gray-950"
    >
      <div className="flex flex-col items-center">
        {/* PRISMA mark */}
        <div className="relative">
          {/* Glow */}
          <div
            aria-hidden
            className="absolute -inset-5 rounded-4xl bg-brand-500/15 blur-2xl dark:bg-brand-500/20"
          />

          {/* Logo */}
          <div className="relative flex size-16 animate-[pulse_2.5s_ease-in-out_infinite] items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br from-brand-500 via-brand-600 to-purple-600 text-2xl font-bold text-white shadow-[0_16px_40px_-12px_rgba(99,102,241,0.65)]">
            {/* Shine */}
            <span
              aria-hidden
              className="absolute inset-0 bg-linear-to-br from-white/30 via-transparent to-transparent"
            />

            <span className="relative tracking-tight">P</span>
          </div>
        </div>

        {/* Brand */}
        <div className="mt-5 text-center">
          <div className="text-base font-bold tracking-tight text-gray-900 dark:text-white">
            PRISMA
          </div>

          <div className="mt-1 text-[10px] font-medium tracking-[0.2em] text-gray-400 uppercase dark:text-gray-500">
            AI Knowledge Platform
          </div>
        </div>

        {/* Loading indicator */}
        <div aria-hidden className="mt-6 flex items-center gap-1.5">
          <span className="size-1.5 animate-[bounce_1.2s_infinite_0ms] rounded-full bg-brand-500" />
          <span className="size-1.5 animate-[bounce_1.2s_infinite_150ms] rounded-full bg-brand-500" />
          <span className="size-1.5 animate-[bounce_1.2s_infinite_300ms] rounded-full bg-brand-500" />
        </div>

        {/* Status */}
        <span className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          {label ?? t("shared.loading")}
        </span>
      </div>
    </div>
  );
}
