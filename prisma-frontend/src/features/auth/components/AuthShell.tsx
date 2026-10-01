import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet } from "react-router";

import GridShape from "@/components/common/GridShape";
import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";

const BRAND_NAME = "P.R.I.S.M.A."; // product name: not translated

export function AuthShell() {
  const { t } = useTranslation();

  return (
    <div className="relative min-h-screen bg-white lg:flex dark:bg-gray-950">
      {/* Left side */}
      <div className="flex min-h-screen w-full flex-col lg:w-1/2">
        {/* Mobile brand */}
        <div className="px-6 pt-8 sm:px-10 lg:hidden">
          <Link to="/" className="inline-flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-950 text-sm font-bold text-white shadow-sm dark:bg-white dark:text-gray-950">
              P
            </span>

            <span className="text-sm font-semibold tracking-[0.18em] text-gray-950 dark:text-white">
              {BRAND_NAME}
            </span>
          </Link>
        </div>

        {/* Auth content */}
        <main className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10 lg:px-16">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Right side */}
      <aside className="relative hidden min-h-screen w-1/2 overflow-hidden bg-gray-950 lg:flex lg:items-center lg:justify-center dark:bg-black">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 h-150 w-150 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/4 blur-3xl" />

          <div className="absolute top-1/2 left-1/2 h-80 w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-400/8 blur-3xl" />
        </div>

        {/* Existing background decoration */}
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <GridShape />
        </div>

        {/* Content */}
        <div className="relative z-10 flex max-w-lg flex-col items-center px-10 text-center">
          {/* Brand */}
          <Link to="/" className="mb-10 inline-flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white text-xl font-bold text-gray-950 shadow-2xl">
              P
            </span>

            <span className="text-xl font-semibold tracking-[0.2em] text-white">
              {BRAND_NAME}
            </span>
          </Link>

          {/* Badge */}
          <div className="mb-6 rounded-full border border-white/10 bg-white/4 px-4 py-2">
            <span className="text-[10px] font-semibold tracking-[0.28em] text-white/50 uppercase">
              {t("auth.brand.tagline")}
            </span>
          </div>

          <h2 className="text-3xl font-semibold tracking-tight text-white xl:text-4xl">
            {t("auth.brand.headlineLine1")}
            <br />
            {t("auth.brand.headlineLine2")}
          </h2>

          <p className="mt-5 max-w-md text-sm leading-7 text-white/50">
            {t("auth.brand.subtext")}
          </p>

          {/* Decorative line */}
          <div className="mt-10 flex items-center gap-3">
            <div className="h-px w-12 bg-white/10" />
            <div className="h-1.5 w-1.5 rounded-full bg-white/30" />
            <div className="h-px w-12 bg-white/10" />
          </div>
        </div>

        {/* Bottom label */}
        <div className="absolute right-0 bottom-8 left-0 text-center">
          <span className="text-[10px] font-medium tracking-[0.24em] text-white/20 uppercase">
            {t("auth.brand.secure")}
          </span>
        </div>
      </aside>

      {/* Theme switcher */}
      <div className="fixed right-6 bottom-6 z-50">
        <ThemeTogglerTwo />
      </div>
    </div>
  );
}
/**
 * Замініть цією версією AuthHeading в AuthShell.tsx (решту AuthShell не чіпайте).
 * `align="center"` — для екранів-результатів з AuthStatusIcon.
 */
export function AuthHeading({
  title,
  subtitle,
  align = "left",
}: {
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}): ReactNode {
  const center = align === "center";

  return (
    <div className={center ? "mb-8 text-center" : "mb-8"}>
      <h1 className="text-2xl font-semibold tracking-tight text-gray-950 sm:text-3xl dark:text-white">
        {title}
      </h1>

      {subtitle && (
        <p
          className={`mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400 ${
            center ? "mx-auto max-w-sm" : "max-w-md"
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
