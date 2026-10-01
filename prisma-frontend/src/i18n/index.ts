import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "../locales/en/common.json";
import ukCommon from "../locales/uk/common.json";
import {
  defaultLocale,
  fallbackLocale,
  locales,
  normalizeLocale,
} from "./config";

export const resources = {
  uk: {
    common: ukCommon,
  },
  en: {
    common: enCommon,
  },
} as const;

export const defaultNS = "common";
export const fallbackLng = fallbackLocale;

function readStoredLocale() {
  try {
    return normalizeLocale(
      localStorage.getItem("i18nextLng") || localStorage.getItem("language"),
    );
  } catch {
    return null; // storage can be unavailable (private mode, blocked cookies)
  }
}

// saved choice -> browser language -> app default. Unsupported values (e.g. a
// stale "ar" in localStorage) are ignored instead of leaving the UI half-translated.
const initialLng =
  (typeof window !== "undefined" ? readStoredLocale() : null) ??
  (typeof navigator !== "undefined"
    ? normalizeLocale(navigator.language)
    : null) ??
  defaultLocale;

i18n.use(initReactI18next).init({
  resources,
  lng: initialLng,
  fallbackLng,
  supportedLngs: [...locales],
  defaultNS,
  ns: ["common"],
  interpolation: {
    escapeValue: false, // React already escapes values
    prefix: "{",
    suffix: "}",
  },
});

export default i18n;
