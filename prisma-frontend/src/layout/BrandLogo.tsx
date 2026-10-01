import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { cn } from "@/utils";

interface BrandLogoProps {
  /** Show the wordmark next to the square (expanded sidebar). */
  showText: boolean;
  className?: string;
}

export default function BrandLogo({ showText, className }: BrandLogoProps) {
  const { t } = useTranslation();
  const name = t("app.name");

  return (
    <Link
      to="/"
      aria-label={name}
      className={cn("group flex items-center gap-3 outline-none", className)}
    >
      {/* Logo mark */}
      <span
        className={cn(
          "relative flex size-10 shrink-0 items-center justify-center",
          "overflow-hidden rounded-xl",
          "bg-linear-to-br from-brand-500 via-brand-600 to-purple-600",
          "text-lg font-bold text-white",
          "shadow-[0_8px_24px_-8px_rgba(99,102,241,0.65)]",
          "transition-all duration-300",
          "group-hover:scale-[1.04] group-hover:shadow-[0_10px_30px_-8px_rgba(99,102,241,0.75)]",
          "group-focus-visible:ring-2 group-focus-visible:ring-brand-500/40",
          "group-focus-visible:ring-offset-2",
          "dark:group-focus-visible:ring-offset-gray-900",
        )}
      >
        {/* Subtle shine */}
        <span
          aria-hidden
          className="absolute inset-0 bg-linear-to-br from-white/25 via-transparent to-transparent"
        />

        <span className="relative font-bold tracking-tight">P</span>
      </span>

      {/* Wordmark */}
      {showText && (
        <span className="min-w-0">
          <span
            className={cn(
              "block truncate",
              "text-[15px] font-bold tracking-tight",
              "text-gray-900 dark:text-white",
              "transition-colors duration-200",
              "group-hover:text-brand-600 dark:group-hover:text-brand-400",
            )}
          >
            {name}
          </span>

          <span className="mt-0.5 block text-[10px] font-medium tracking-[0.16em] text-gray-400 uppercase dark:text-gray-500">
            AI Knowledge Platform
          </span>
        </span>
      )}
    </Link>
  );
}
