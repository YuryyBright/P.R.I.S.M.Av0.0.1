import i18n from "@/i18n";
import { INTL_LOCALES, defaultLocale, normalizeLocale } from "@/i18n/config";

/** Intl tag of the active UI language ("uk-UA" / "en-US"). Call at render time so it follows language changes. */
export function currentDateLocale(): string {
  const lng = normalizeLocale(i18n.resolvedLanguage || i18n.language) ?? defaultLocale;
  return INTL_LOCALES[lng];
}

/**
 * FastAPI serialises naive datetimes WITHOUT an offset ("2026-09-30T12:00:00").
 * `new Date()` would read that as LOCAL time. We assume the backend stores UTC
 * and append "Z" when the offset is missing. Verify against real responses.
 */
const HAS_TZ = /(Z|[+-]\d{2}:?\d{2})$/i;

export function parseApiDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(HAS_TZ.test(value) ? value : `${value}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(value?: string | null, locale = currentDateLocale()): string {
  const d = parseApiDate(value);
  return d ? d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "—";
}

export function formatDate(value?: string | null, locale = currentDateLocale()): string {
  const d = parseApiDate(value);
  return d ? d.toLocaleDateString(locale, { dateStyle: "medium" }) : "—";
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO from API -> value for <input type="datetime-local"> (local time, minute precision). */
export function toInputValue(value?: string | null): string {
  const d = parseApiDate(value);
  if (!d) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * <input type="datetime-local"> value -> ISO UTC ("...Z") for the API.
 * If the DB column is naive and asyncpg complains about offset-aware values,
 * strip the "Z" here.
 */
export function fromInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
