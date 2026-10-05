/**
 * Shared Tailwind class strings of the documents feature.
 * One place for the visual language: change a radius or a colour here, not in ten files.
 */

export const focusRing =
  "focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none";

/** Centered page column used by the document page. */
export const pageContainer = "mx-auto w-full max-w-6xl space-y-6";

export const surface =
  "overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3";

export const skeleton =
  "animate-pulse rounded-md bg-gray-100 motion-reduce:animate-none dark:bg-white/5";

export const mutedText = "text-gray-500 dark:text-gray-400";

export const linkClass = `rounded transition-colors hover:text-gray-800 dark:hover:text-white/90 ${focusRing}`;

export const sectionLabel =
  "text-theme-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400";

const iconBtnBase = `inline-flex items-center justify-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-40 ${focusRing}`;

export const iconBtnOutlined = `${iconBtnBase} size-9 border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5`;

export const iconBtnGhost = `${iconBtnBase} size-8 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5`;

/**
 * Layout for any button that contains an icon/spinner + text.
 * Tailwind preflight makes <svg> `display:block`, so without a flex row the
 * icon drops above the label. Append to btnPrimary / btnSecondary / btnDanger.
 */
export const btnContent =
  "inline-flex! flex-row! flex-nowrap! items-center! justify-center! gap-2! whitespace-nowrap [&>svg]:shrink-0";
