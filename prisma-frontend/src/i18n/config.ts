/**
 * Single source of truth for supported locales.
 * Deliberately has NO imports (no icons, no React) so that plain TS modules
 * (api layer, date helpers) can depend on it without pulling UI code in.
 */
export const locales = ["uk", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "uk";
export const fallbackLocale: Locale = "en";

export const isLocale = (v: unknown): v is Locale =>
  typeof v === "string" && (locales as readonly string[]).includes(v);

/** "uk-UA" / "EN_us" / "uk" -> "uk" | "en"; anything unsupported -> null. */
export function normalizeLocale(value?: string | null): Locale | null {
  if (!value) return null;
  const base = value.toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : null;
}

/** BCP-47 tags for Intl / toLocale*String formatting. */
export const INTL_LOCALES: Record<Locale, string> = {
  uk: "uk-UA",
  en: "en-US",
};
