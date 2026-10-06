import { useId, type ReactNode } from "react";

/** Shared look of this feature's surfaces: identical to collections cards/tables. */
export const surface =
  "overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3";
export const skeleton =
  "animate-pulse rounded-md bg-gray-100 motion-reduce:animate-none dark:bg-white/5";
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40";
export const iconButton = `inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 active:bg-gray-200 disabled:pointer-events-none disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white/90 dark:active:bg-white/10 ${focusRing}`;

/* ───────── Switch ───────── */

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}

/** Labeled on/off row (role=switch, keyboard + screen reader friendly). */
export function Switch({ checked, onChange, label, hint, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label
          id={`${id}-l`}
          htmlFor={id}
          className="text-theme-sm font-medium text-gray-800 dark:text-white/90"
        >
          {label}
        </label>
        {hint && (
          <p
            id={`${id}-h`}
            className="mt-0.5 text-theme-xs leading-5 text-gray-500 dark:text-gray-400"
          >
            {hint}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? `${id}-h` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-10.5 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${
          checked ? "bg-brand-500" : "bg-gray-200 dark:bg-white/15"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 start-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-4.5 rtl:-translate-x-4.5" : ""
          }`}
        />
      </button>
    </div>
  );
}

/* ───────── Segmented control ───────── */

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: ReactNode; disabled?: boolean }[];
  label: string;
  className?: string;
  size?: "sm" | "md";
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className = "",
  size = "md",
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex rounded-xl bg-gray-100 p-0.5 dark:bg-white/5 ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] font-medium whitespace-nowrap transition-all disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${
              size === "sm" ? "h-7 px-2.5 text-theme-xs" : "h-8.5 px-3.5 text-theme-sm"
            } ${
              active
                ? "bg-white text-gray-900 shadow-xs dark:bg-white/10 dark:text-white"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90"
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ───────── Section header inside panels ───────── */

export function PanelSection({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="space-y-3 border-b border-gray-100 py-4 first:pt-0 last:border-b-0 dark:border-white/5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-theme-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/* ───────── pill / chip ───────── */

export function Pill({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "success" | "warning" | "error";
  className?: string;
}) {
  const tones = {
    neutral: "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300",
    brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
    success:
      "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
    warning:
      "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-orange-400",
    error: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-theme-xs font-medium whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Icon tile used in empty states / card headers (same as collections FolderTile). */
export function IconTile({
  children,
  tone = "neutral",
  className = "size-10",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand";
  className?: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${className} ${
        tone === "brand"
          ? "bg-brand-50 text-brand-500 ring-brand-200/60 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/20"
          : "bg-gray-50 text-gray-500 ring-gray-200/70 dark:bg-white/5 dark:text-gray-400 dark:ring-white/5"
      }`}
    >
      {children}
    </span>
  );
}
